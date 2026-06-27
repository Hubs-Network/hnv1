// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v5.0.2/contracts/token/ERC721/ERC721.sol";
import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v5.0.2/contracts/utils/cryptography/EIP712.sol";
import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v5.0.2/contracts/utils/cryptography/ECDSA.sol";

// =============================================================================
// REDEPLOY CANDIDATE — initial proposed-skills cap raised from 3 to 5.
//
// Changes vs the currently deployed PilgrimPassportSBT:
//   1) MAX_INITIAL_SKILLS: 3 -> 5
//   2) ClaimRequest.proposedSkills: bytes32[3] -> bytes32[5]
//
// Nothing else changes: EIP-712 name/version, all typehashes, the external ABI
// (proposedSkills/approvedSkills are bytes32[] in calldata), and the constructor
// signature are identical. The frontend only needs MAX_INITIAL_SKILLS=5 and the
// new contract address; signing/typed-data code is unchanged.
// =============================================================================

interface IHubsNetworkBadgeSBT {
    function isApprovedHub(address hubSafe) external view returns (bool);
    function hasBadge(address hubSafe) external view returns (bool);
    function badgeOf(address hubSafe) external view returns (uint256);
}

interface ISafe {
    function isOwner(address owner) external view returns (bool);
}

contract PilgrimPassportSBT is ERC721, EIP712 {
    using ECDSA for bytes32;

    uint256 public constant MAX_INITIAL_SKILLS = 10;
    uint256 public constant MAX_ATTEST_SKILLS = 10;

    enum ClaimStatus { None, Pending, Minted, Cancelled, Rejected }

    struct ClaimRequest {
        address applicant;
        address hubSafe;
        bytes32[10] proposedSkills;
        uint8 skillCount;
        ClaimStatus status;
        uint64 createdAt;
    }

    struct SkillAttestation {
        address hubSafe;
        address signer;
        uint64 timestamp;
        bool revoked;
    }

    struct ClaimRequestParams {
        address applicant;
        address hubSafe;
        bytes32[] proposedSkills;
        uint256 applicantNonce;
        uint256 signatureDeadline;
    }

    struct ApproveClaimParams {
        bytes32 claimId;
        address signer;
        bytes32[] approvedSkills;
        uint256 signatureDeadline;
    }

    struct AttestSkillsParams {
        uint256 tokenId;
        address hubSafe;
        address signer;
        bytes32[] skillIds;
        uint256 signatureDeadline;
    }

    struct RevokeAttestationParams {
        uint256 tokenId;
        bytes32 skillId;
        address hubSafe;
        address signer;
        uint256 signatureDeadline;
    }

    struct SetSkillStatusParams {
        bytes32 skillId;
        bool active;
        address signer;
        uint256 nonce;
        uint256 signatureDeadline;
    }

    bytes32 private constant CLAIM_REQUEST_TYPEHASH = keccak256(
        "ClaimRequest(address applicant,address hubSafe,bytes32 proposedSkillsHash,uint256 applicantNonce,uint256 signatureDeadline)"
    );
    bytes32 private constant APP_AUTHORIZATION_TYPEHASH = keccak256(
        "AppAuthorization(address applicant,address hubSafe,bytes32 proposedSkillsHash,uint256 applicantNonce,uint256 signatureDeadline)"
    );
    bytes32 private constant APPROVE_CLAIM_TYPEHASH = keccak256(
        "ApproveClaim(bytes32 claimId,address applicant,address hubSafe,bytes32 approvedSkillsHash,address signer,uint256 signatureDeadline)"
    );
    bytes32 private constant ATTEST_SKILLS_TYPEHASH = keccak256(
        "AttestSkills(uint256 tokenId,address hubSafe,address signer,bytes32 skillIdsHash,uint256 signatureDeadline)"
    );
    bytes32 private constant REVOKE_ATTESTATION_TYPEHASH = keccak256(
        "RevokeAttestation(uint256 tokenId,bytes32 skillId,address hubSafe,address signer,uint256 signatureDeadline)"
    );
    bytes32 private constant SET_SKILL_STATUS_TYPEHASH = keccak256(
        "SetSkillStatus(bytes32 skillId,bool active,address signer,uint256 nonce,uint256 signatureDeadline)"
    );

    IHubsNetworkBadgeSBT public hubBadgeSBT;
    address public hnDirectorsSafe;
    address public appSigner;
    uint256 private nextTokenId;

    mapping(bytes32 => bool) public validSkill;
    mapping(address => uint256) public tokenOfOwner;

    mapping(bytes32 => ClaimRequest) public claimRequests;
    mapping(address => bytes32[]) private applicantClaimIds;
    mapping(address => bytes32[]) private hubClaimIds;
    mapping(address => uint256) public claimNonces;

    mapping(uint256 => bytes32[]) private tokenSkills;
    mapping(uint256 => mapping(bytes32 => bool)) public hasSkill;

    mapping(uint256 => mapping(bytes32 => SkillAttestation[])) private skillAttestations;
    mapping(uint256 => mapping(bytes32 => mapping(address => uint256))) private attestationIndexPlusOne;

    mapping(bytes32 => bool) private usedDigests;
    mapping(address => uint256) public hnDirectorNonces;

    error ZeroAddress();
    error ZeroSigner();
    error InvalidSignature();
    error SignatureAlreadyUsed();
    error DeadlineExpired();
    error AlreadyHasPassport(address applicant);
    error InvalidApplicant();
    error InvalidHubSafe();
    error InvalidSkill(bytes32 skillId);
    error DuplicateSkill(bytes32 skillId);
    error InvalidSkillCount(uint256 count);
    error NotApprovedHub(address hubSafe);
    error NotSafeOwner(address safe, address signer);
    error NonceMismatch(uint256 expected, uint256 provided);
    error DuplicateClaim(bytes32 claimId);
    error ClaimNotPending(bytes32 claimId);
    error SkillNotProposed(bytes32 skillId);
    error TokenDoesNotExist(uint256 tokenId);
    error DuplicateAttestation(uint256 tokenId, bytes32 skillId, address hubSafe);
    error AttestationNotFound(uint256 tokenId, bytes32 skillId, address hubSafe);
    error AttestationAlreadyRevoked(uint256 tokenId, bytes32 skillId, address hubSafe);
    error TransferNotAllowed();
    error ApprovalNotAllowed();

    event PassportClaimRequested(bytes32 indexed claimId, address indexed applicant, address indexed hubSafe);
    event PassportMinted(address indexed pilgrim, uint256 indexed tokenId, address indexed hubSafe, address signer);
    event SkillStatusUpdated(bytes32 indexed skillId, bool active);
    event SkillAdded(uint256 indexed tokenId, bytes32 indexed skillId);
    event SkillAttested(uint256 indexed tokenId, bytes32 indexed skillId, address indexed hubSafe, address signer);
    event SkillAttestationRevoked(uint256 indexed tokenId, bytes32 indexed skillId, address indexed hubSafe, address signer);

    constructor(
        address hubBadgeSBTAddress,
        address hnDirectorsSafeAddress,
        address appSigner_,
        bytes32[] memory initialSkills
    ) ERC721("Hubs Network Pilgrim Passport", "HNPASS") EIP712("PilgrimPassportSBT", "1") {
        _requireNonZeroAddress(hubBadgeSBTAddress);
        _requireNonZeroAddress(hnDirectorsSafeAddress);
        _requireNonZeroAddress(appSigner_);
        hubBadgeSBT = IHubsNetworkBadgeSBT(hubBadgeSBTAddress);
        hnDirectorsSafe = hnDirectorsSafeAddress;
        appSigner = appSigner_;
        for (uint256 i = 0; i < initialSkills.length; i++) {
            bytes32 skillId = initialSkills[i];
            if (skillId == bytes32(0)) revert InvalidSkill(skillId);
            validSkill[skillId] = true;
            emit SkillStatusUpdated(skillId, true);
        }
    }

    function requestPassportClaim(
        ClaimRequestParams calldata params,
        bytes calldata applicantSignature,
        bytes calldata appSignature
    ) external returns (bytes32 claimId) {
        if (params.applicant == address(0)) revert InvalidApplicant();
        if (params.hubSafe == address(0)) revert InvalidHubSafe();
        if (tokenOfOwner[params.applicant] != 0) revert AlreadyHasPassport(params.applicant);
        _validateSkillList(params.proposedSkills, 1, MAX_INITIAL_SKILLS);
        if (!hubBadgeSBT.isApprovedHub(params.hubSafe)) revert NotApprovedHub(params.hubSafe);
        if (params.applicantNonce != claimNonces[params.applicant]) {
            revert NonceMismatch(claimNonces[params.applicant], params.applicantNonce);
        }
        _requireDeadline(params.signatureDeadline);

        bytes32 skillsHash = _hashSkills(params.proposedSkills);
        bytes32 claimDigest = _hashTypedDataV4(keccak256(abi.encode(
            CLAIM_REQUEST_TYPEHASH, params.applicant, params.hubSafe, skillsHash, params.applicantNonce, params.signatureDeadline
        )));
        bytes32 appDigest = _hashTypedDataV4(keccak256(abi.encode(
            APP_AUTHORIZATION_TYPEHASH, params.applicant, params.hubSafe, skillsHash, params.applicantNonce, params.signatureDeadline
        )));

        _requireSigner(claimDigest, applicantSignature, params.applicant);
        _requireSigner(appDigest, appSignature, appSigner);
        _consumeDigest(claimDigest);
        _consumeDigest(appDigest);

        claimId = keccak256(abi.encode(params.applicant, params.hubSafe, skillsHash, params.applicantNonce));
        if (claimRequests[claimId].status != ClaimStatus.None) revert DuplicateClaim(claimId);

        claimNonces[params.applicant]++;
        _storeClaim(claimId, params);
        emit PassportClaimRequested(claimId, params.applicant, params.hubSafe);
    }

    function approveClaimAndMint(
        ApproveClaimParams calldata params,
        bytes calldata hubSignature
    ) external returns (uint256 tokenId) {
        ClaimRequest storage claim = claimRequests[params.claimId];
        if (claim.status != ClaimStatus.Pending) revert ClaimNotPending(params.claimId);
        if (tokenOfOwner[claim.applicant] != 0) revert AlreadyHasPassport(claim.applicant);
        _validateSkillList(params.approvedSkills, 1, MAX_INITIAL_SKILLS);
        for (uint256 i = 0; i < params.approvedSkills.length; i++) {
            if (!_isProposedSkill(claim, params.approvedSkills[i])) revert SkillNotProposed(params.approvedSkills[i]);
        }
        _validateHubSigner(claim.hubSafe, params.signer, params.signatureDeadline);

        bytes32 digest = _hashTypedDataV4(keccak256(abi.encode(
            APPROVE_CLAIM_TYPEHASH,
            params.claimId,
            claim.applicant,
            claim.hubSafe,
            _hashSkills(params.approvedSkills),
            params.signer,
            params.signatureDeadline
        )));
        _requireSigner(digest, hubSignature, params.signer);
        _consumeDigest(digest);

        tokenId = ++nextTokenId;
        _mint(claim.applicant, tokenId);
        tokenOfOwner[claim.applicant] = tokenId;
        claim.status = ClaimStatus.Minted;

        for (uint256 i = 0; i < params.approvedSkills.length; i++) {
            bytes32 skillId = params.approvedSkills[i];
            _addSkillIfMissing(tokenId, skillId);
            _addSkillAttestation(tokenId, skillId, claim.hubSafe, params.signer);
            emit SkillAttested(tokenId, skillId, claim.hubSafe, params.signer);
        }
        emit PassportMinted(claim.applicant, tokenId, claim.hubSafe, params.signer);
    }

    function attestSkills(
        AttestSkillsParams calldata params,
        bytes calldata hubSignature
    ) external {
        _requireTokenExists(params.tokenId);
        _validateSkillList(params.skillIds, 1, MAX_ATTEST_SKILLS);
        _validateHubSigner(params.hubSafe, params.signer, params.signatureDeadline);

        bytes32 digest = _hashTypedDataV4(keccak256(abi.encode(
            ATTEST_SKILLS_TYPEHASH,
            params.tokenId,
            params.hubSafe,
            params.signer,
            _hashSkills(params.skillIds),
            params.signatureDeadline
        )));
        _requireSigner(digest, hubSignature, params.signer);
        _consumeDigest(digest);

        for (uint256 i = 0; i < params.skillIds.length; i++) {
            bytes32 skillId = params.skillIds[i];
            _addSkillIfMissing(params.tokenId, skillId);
            _addSkillAttestation(params.tokenId, skillId, params.hubSafe, params.signer);
            emit SkillAttested(params.tokenId, skillId, params.hubSafe, params.signer);
        }
    }

    function revokeAttestation(
        RevokeAttestationParams calldata params,
        bytes calldata hubSignature
    ) external {
        _requireTokenExists(params.tokenId);
        if (!hasSkill[params.tokenId][params.skillId]) revert SkillNotProposed(params.skillId);
        _validateHubSigner(params.hubSafe, params.signer, params.signatureDeadline);

        uint256 idxPlusOne = attestationIndexPlusOne[params.tokenId][params.skillId][params.hubSafe];
        if (idxPlusOne == 0) revert AttestationNotFound(params.tokenId, params.skillId, params.hubSafe);
        SkillAttestation storage att = skillAttestations[params.tokenId][params.skillId][idxPlusOne - 1];
        if (att.revoked) revert AttestationAlreadyRevoked(params.tokenId, params.skillId, params.hubSafe);

        bytes32 digest = _hashTypedDataV4(keccak256(abi.encode(
            REVOKE_ATTESTATION_TYPEHASH,
            params.tokenId,
            params.skillId,
            params.hubSafe,
            params.signer,
            params.signatureDeadline
        )));
        _requireSigner(digest, hubSignature, params.signer);
        _consumeDigest(digest);

        att.revoked = true;
        emit SkillAttestationRevoked(params.tokenId, params.skillId, params.hubSafe, params.signer);
    }

    function setSkillStatusByHNDirector(
        SetSkillStatusParams calldata params,
        bytes calldata signature
    ) external {
        if (params.skillId == bytes32(0)) revert InvalidSkill(params.skillId);
        _requireNonZeroSigner(params.signer);
        if (params.nonce != hnDirectorNonces[params.signer]) {
            revert NonceMismatch(hnDirectorNonces[params.signer], params.nonce);
        }
        _requireDeadline(params.signatureDeadline);
        if (!ISafe(hnDirectorsSafe).isOwner(params.signer)) revert NotSafeOwner(hnDirectorsSafe, params.signer);

        bytes32 digest = _hashTypedDataV4(keccak256(abi.encode(
            SET_SKILL_STATUS_TYPEHASH,
            params.skillId,
            params.active,
            params.signer,
            params.nonce,
            params.signatureDeadline
        )));
        _requireSigner(digest, signature, params.signer);
        _consumeDigest(digest);

        hnDirectorNonces[params.signer]++;
        validSkill[params.skillId] = params.active;
        emit SkillStatusUpdated(params.skillId, params.active);
    }

    function tokenOf(address owner) external view returns (uint256) {
        return tokenOfOwner[owner];
    }

    function getSkills(uint256 tokenId) external view returns (bytes32[] memory) {
        return tokenSkills[tokenId];
    }

    function getSkillAttestations(uint256 tokenId, bytes32 skillId) external view returns (SkillAttestation[] memory) {
        return skillAttestations[tokenId][skillId];
    }

    function hasActiveAttestation(uint256 tokenId, bytes32 skillId, address hubSafe) external view returns (bool) {
        uint256 idxPlusOne = attestationIndexPlusOne[tokenId][skillId][hubSafe];
        if (idxPlusOne == 0) return false;
        return !skillAttestations[tokenId][skillId][idxPlusOne - 1].revoked;
    }

    function getApplicantClaims(address applicant) external view returns (bytes32[] memory) {
        return applicantClaimIds[applicant];
    }

    function getHubClaims(address hubSafe) external view returns (bytes32[] memory) {
        return hubClaimIds[hubSafe];
    }

    /// @notice Proposed skills for a claim (the auto getter for `claimRequests`
    /// omits the fixed-size array). Lets the frontend read proposals with a
    /// single call instead of reconstructing them from event/calldata.
    function getClaimProposedSkills(bytes32 claimId) external view returns (bytes32[] memory skills) {
        ClaimRequest storage claim = claimRequests[claimId];
        uint256 n = claim.skillCount;
        skills = new bytes32[](n);
        for (uint256 i = 0; i < n; i++) {
            skills[i] = claim.proposedSkills[i];
        }
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireTokenExists(tokenId);
        return "";
    }

    function _storeClaim(bytes32 claimId, ClaimRequestParams calldata params) internal {
        ClaimRequest storage claim = claimRequests[claimId];
        claim.applicant = params.applicant;
        claim.hubSafe = params.hubSafe;
        claim.skillCount = uint8(params.proposedSkills.length);
        claim.status = ClaimStatus.Pending;
        claim.createdAt = uint64(block.timestamp);
        for (uint256 i = 0; i < params.proposedSkills.length; i++) {
            claim.proposedSkills[i] = params.proposedSkills[i];
        }
        applicantClaimIds[params.applicant].push(claimId);
        hubClaimIds[params.hubSafe].push(claimId);
    }

    function _requireNonZeroAddress(address value) internal pure {
        if (value == address(0)) revert ZeroAddress();
    }

    function _requireNonZeroSigner(address signer) internal pure {
        if (signer == address(0)) revert ZeroSigner();
    }

    function _requireDeadline(uint256 deadline) internal view {
        if (deadline < block.timestamp) revert DeadlineExpired();
    }

    function _requireTokenExists(uint256 tokenId) internal view {
        if (_ownerOf(tokenId) == address(0)) revert TokenDoesNotExist(tokenId);
    }

    function _requireSigner(bytes32 digest, bytes calldata signature, address expectedSigner) internal pure {
        if (expectedSigner == address(0)) revert ZeroSigner();
        if (ECDSA.recover(digest, signature) != expectedSigner) revert InvalidSignature();
    }

    function _consumeDigest(bytes32 digest) internal {
        if (usedDigests[digest]) revert SignatureAlreadyUsed();
        usedDigests[digest] = true;
    }

    function _hashSkills(bytes32[] calldata skillIds) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(skillIds));
    }

    function _validateSkillList(bytes32[] calldata skillIds, uint256 min, uint256 max) internal view {
        uint256 len = skillIds.length;
        if (len < min || len > max) revert InvalidSkillCount(len);
        for (uint256 i = 0; i < len; i++) {
            bytes32 skillId = skillIds[i];
            if (!validSkill[skillId]) revert InvalidSkill(skillId);
            for (uint256 j = i + 1; j < len; j++) {
                if (skillIds[j] == skillId) revert DuplicateSkill(skillId);
            }
        }
    }

    function _validateHubSigner(address hubSafe, address signer, uint256 signatureDeadline) internal view {
        _requireNonZeroSigner(signer);
        _requireDeadline(signatureDeadline);
        if (!hubBadgeSBT.isApprovedHub(hubSafe)) revert NotApprovedHub(hubSafe);
        if (!ISafe(hubSafe).isOwner(signer)) revert NotSafeOwner(hubSafe, signer);
    }

    function _addSkillIfMissing(uint256 tokenId, bytes32 skillId) internal {
        if (!hasSkill[tokenId][skillId]) {
            hasSkill[tokenId][skillId] = true;
            tokenSkills[tokenId].push(skillId);
            emit SkillAdded(tokenId, skillId);
        }
    }

    function _addSkillAttestation(uint256 tokenId, bytes32 skillId, address hubSafe, address signer) internal {
        uint256 idxPlusOne = attestationIndexPlusOne[tokenId][skillId][hubSafe];
        if (idxPlusOne != 0 && !skillAttestations[tokenId][skillId][idxPlusOne - 1].revoked) {
            revert DuplicateAttestation(tokenId, skillId, hubSafe);
        }
        skillAttestations[tokenId][skillId].push(SkillAttestation(hubSafe, signer, uint64(block.timestamp), false));
        attestationIndexPlusOne[tokenId][skillId][hubSafe] = skillAttestations[tokenId][skillId].length;
    }

    function _isProposedSkill(ClaimRequest storage claim, bytes32 skillId) internal view returns (bool) {
        for (uint256 i = 0; i < claim.skillCount; i++) {
            if (claim.proposedSkills[i] == skillId) return true;
        }
        return false;
    }

    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);
        if (from != address(0) && to != address(0)) revert TransferNotAllowed();
        return super._update(to, tokenId, auth);
    }

    function approve(address, uint256) public pure override {
        revert ApprovalNotAllowed();
    }

    function setApprovalForAll(address, bool) public pure override {
        revert ApprovalNotAllowed();
    }

    function transferFrom(address, address, uint256) public pure override {
        revert TransferNotAllowed();
    }

    function safeTransferFrom(address, address, uint256, bytes memory) public pure override {
        revert TransferNotAllowed();
    }
}
