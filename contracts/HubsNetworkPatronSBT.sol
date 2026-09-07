// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v5.0.2/contracts/token/ERC721/ERC721.sol";
import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v5.0.2/contracts/utils/cryptography/EIP712.sol";
import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v5.0.2/contracts/utils/cryptography/ECDSA.sol";

interface ISafe {
    function isOwner(address owner) external view returns (bool);
}

/**
 * @title HubsNetworkPatronSBT
 * @notice Soulbound ERC-721 representing a Patron (organization/company) in the
 *         Hubs Network. Each Patron selects between MIN_SKILL_COUNT and
 *         MAX_SKILL_COUNT canonical skills at application time; these are
 *         immutable after minting.
 *
 *         One wallet may own multiple Patron SBTs.
 *         Tokens are non-transferable (soulbound). Only mint and burn are allowed.
 *
 *         All write operations use EIP-712 signatures so that a backend relayer
 *         can submit transactions on behalf of applicants and HN Directors.
 *
 * @dev    `patronTokensByOwner` may contain burned token IDs. Use
 *         `isActivePatron()` or `getActivePatronTokens()` to filter.
 */
contract HubsNetworkPatronSBT is ERC721, EIP712 {
    using ECDSA for bytes32;

    // ──────────────────────────── Constants ────────────────────────────

    /// @notice A Patron application must contain between 1 and 10 skills.
    uint256 public constant MIN_SKILL_COUNT = 1;
    uint256 public constant MAX_SKILL_COUNT = 10;

    // ──────────────────────────── Enums ────────────────────────────────

    enum ApplicationStatus {
        None,
        Pending,
        Minted,
        Rejected
    }

    // ──────────────────────────── Structs ──────────────────────────────

    struct PatronApplication {
        address applicant;
        bytes32[] proposedSkills; // dynamic: 1..MAX_SKILL_COUNT
        uint8 skillCount;
        ApplicationStatus status;
        uint64 createdAt;
        uint256 tokenId;
    }

    struct PatronApplicationParams {
        address applicant;
        bytes32[] proposedSkills;
        uint256 applicantNonce;
        uint256 signatureDeadline;
    }

    struct ApproveApplicationParams {
        bytes32 applicationId;
        address signer;
        uint256 signatureDeadline;
    }

    struct RejectApplicationParams {
        bytes32 applicationId;
        address signer;
        uint256 signatureDeadline;
    }

    struct RevokePatronParams {
        uint256 tokenId;
        address signer;
        uint256 nonce;
        uint256 signatureDeadline;
    }

    struct SetSkillStatusParams {
        bytes32 skillId;
        bool active;
        address signer;
        uint256 nonce;
        uint256 signatureDeadline;
    }

    // ──────────────────────────── EIP-712 Type Hashes ──────────────────

    bytes32 private constant PATRON_APPLICATION_TYPEHASH = keccak256(
        "PatronApplication(address applicant,bytes32 proposedSkillsHash,uint256 applicantNonce,uint256 signatureDeadline)"
    );

    bytes32 private constant APP_AUTHORIZATION_TYPEHASH = keccak256(
        "AppAuthorization(address applicant,bytes32 proposedSkillsHash,uint256 applicantNonce,uint256 signatureDeadline)"
    );

    bytes32 private constant APPROVE_PATRON_APPLICATION_TYPEHASH = keccak256(
        "ApprovePatronApplication(bytes32 applicationId,address applicant,bytes32 skillsHash,address signer,uint256 signatureDeadline)"
    );

    bytes32 private constant REJECT_PATRON_APPLICATION_TYPEHASH = keccak256(
        "RejectPatronApplication(bytes32 applicationId,address applicant,address signer,uint256 signatureDeadline)"
    );

    bytes32 private constant REVOKE_PATRON_TYPEHASH = keccak256(
        "RevokePatron(uint256 tokenId,address patronOwner,address signer,uint256 nonce,uint256 signatureDeadline)"
    );

    bytes32 private constant SET_SKILL_STATUS_TYPEHASH = keccak256(
        "SetSkillStatus(bytes32 skillId,bool active,address signer,uint256 nonce,uint256 signatureDeadline)"
    );

    // ──────────────────────────── State ────────────────────────────────

    address public hnDirectorsSafe;
    address public appSigner;
    uint256 private nextTokenId;

    // Canonical skill registry
    mapping(bytes32 => bool) public validSkill;

    // Application storage
    mapping(bytes32 => PatronApplication) public applications;
    mapping(address => bytes32[]) private applicantApplicationIds;
    mapping(address => uint256) public applicationNonces;

    // Token skill storage (immutable after mint)
    mapping(uint256 => bytes32[]) private tokenSkills;
    mapping(uint256 => mapping(bytes32 => bool)) public hasSkill;

    // Multiple Patrons per wallet
    /// @dev May contain burned token IDs. Use `isActivePatron()` to filter.
    mapping(address => uint256[]) private patronTokensByOwner;

    // Replay protection
    mapping(bytes32 => bool) private usedDigests;
    mapping(address => uint256) public hnDirectorNonces;

    // ──────────────────────────── Errors ───────────────────────────────

    error ZeroAddress();
    error ZeroSigner();
    error InvalidSignature();
    error SignatureAlreadyUsed();
    error DeadlineExpired();

    error InvalidApplicant();

    error InvalidSkill(bytes32 skillId);
    error DuplicateSkill(bytes32 skillId);
    error InvalidSkillCount(uint256 count);

    error NonceMismatch(uint256 expected, uint256 provided);

    error DuplicateApplication(bytes32 applicationId);
    error ApplicationNotPending(bytes32 applicationId);

    error NotHNDirector(address signer);

    error TokenDoesNotExist(uint256 tokenId);

    error TransferNotAllowed();
    error ApprovalNotAllowed();

    // ──────────────────────────── Events ───────────────────────────────

    event PatronApplicationRequested(
        bytes32 indexed applicationId,
        address indexed applicant
    );

    event PatronApplicationRejected(
        bytes32 indexed applicationId,
        address indexed applicant,
        address indexed rejectedBy
    );

    event PatronMinted(
        bytes32 indexed applicationId,
        uint256 indexed tokenId,
        address indexed patronOwner,
        address approver
    );

    event PatronRevoked(
        uint256 indexed tokenId,
        address indexed patronOwner,
        address indexed revokedBy
    );

    event SkillStatusUpdated(
        bytes32 indexed skillId,
        bool active
    );

    // ──────────────────────────── Constructor ──────────────────────────

    constructor(
        address hnDirectorsSafeAddress,
        address appSignerAddress,
        bytes32[] memory initialSkills
    )
        ERC721("Hubs Network Patron", "HNPATRON")
        EIP712("HubsNetworkPatronSBT", "1")
    {
        if (hnDirectorsSafeAddress == address(0)) revert ZeroAddress();
        if (appSignerAddress == address(0)) revert ZeroAddress();

        hnDirectorsSafe = hnDirectorsSafeAddress;
        appSigner = appSignerAddress;

        for (uint256 i = 0; i < initialSkills.length; i++) {
            bytes32 skillId = initialSkills[i];
            if (skillId == bytes32(0)) revert InvalidSkill(skillId);
            validSkill[skillId] = true;
            emit SkillStatusUpdated(skillId, true);
        }
    }

    // ──────────────────────────── Application ─────────────────────────

    /**
     * @notice Submit a Patron application. Requires dual EIP-712 signatures
     *         from the applicant and the trusted app backend.
     * @param params Application parameters including 1..MAX_SKILL_COUNT skills.
     * @param applicantSignature EIP-712 signature from `params.applicant`.
     * @param appSignature EIP-712 signature from the trusted `appSigner`.
     * @return applicationId Deterministic identifier for the application.
     */
    function requestPatronApplication(
        PatronApplicationParams calldata params,
        bytes calldata applicantSignature,
        bytes calldata appSignature
    ) external returns (bytes32 applicationId) {
        if (params.applicant == address(0)) revert InvalidApplicant();

        uint256 count = params.proposedSkills.length;
        if (count < MIN_SKILL_COUNT || count > MAX_SKILL_COUNT) {
            revert InvalidSkillCount(count);
        }
        _validateSkillList(params.proposedSkills);
        if (params.applicantNonce != applicationNonces[params.applicant]) {
            revert NonceMismatch(applicationNonces[params.applicant], params.applicantNonce);
        }
        _requireDeadline(params.signatureDeadline);

        bytes32 skillsHash = _hashSkills(params.proposedSkills);

        // Verify applicant signature
        bytes32 applicantDigest = _hashTypedDataV4(keccak256(abi.encode(
            PATRON_APPLICATION_TYPEHASH,
            params.applicant,
            skillsHash,
            params.applicantNonce,
            params.signatureDeadline
        )));
        _requireSigner(applicantDigest, applicantSignature, params.applicant);
        _consumeDigest(applicantDigest);

        // Verify app signature
        bytes32 appDigest = _hashTypedDataV4(keccak256(abi.encode(
            APP_AUTHORIZATION_TYPEHASH,
            params.applicant,
            skillsHash,
            params.applicantNonce,
            params.signatureDeadline
        )));
        _requireSigner(appDigest, appSignature, appSigner);
        _consumeDigest(appDigest);

        // Deterministic application ID
        applicationId = keccak256(abi.encode(
            params.applicant,
            skillsHash,
            params.applicantNonce
        ));
        if (applications[applicationId].status != ApplicationStatus.None) {
            revert DuplicateApplication(applicationId);
        }

        // Increment nonce
        applicationNonces[params.applicant]++;

        // Store application
        PatronApplication storage app = applications[applicationId];
        app.applicant = params.applicant;
        app.skillCount = uint8(count);
        app.status = ApplicationStatus.Pending;
        app.createdAt = uint64(block.timestamp);
        for (uint256 i = 0; i < count; i++) {
            app.proposedSkills.push(params.proposedSkills[i]);
        }

        applicantApplicationIds[params.applicant].push(applicationId);

        emit PatronApplicationRequested(applicationId, params.applicant);
    }

    // ──────────────────────── Approve & Mint ──────────────────────────

    /**
     * @notice An HN Director approves a pending application and mints the
     *         Patron SBT with the exact skills from the application.
     * @param params Approval parameters (applicationId, director signer, deadline).
     * @param directorSignature EIP-712 signature from the HN Director.
     * @return tokenId The newly minted Patron SBT token ID.
     */
    function approveApplicationAndMint(
        ApproveApplicationParams calldata params,
        bytes calldata directorSignature
    ) external returns (uint256 tokenId) {
        PatronApplication storage app = applications[params.applicationId];
        if (app.status != ApplicationStatus.Pending) {
            revert ApplicationNotPending(params.applicationId);
        }

        _requireNonZeroSigner(params.signer);
        _requireDeadline(params.signatureDeadline);
        _requireHNDirector(params.signer);

        // Re-validate all skills are still active
        for (uint256 i = 0; i < app.skillCount; i++) {
            if (!validSkill[app.proposedSkills[i]]) {
                revert InvalidSkill(app.proposedSkills[i]);
            }
        }

        // Reconstruct fields from stored application (not from client)
        bytes32 skillsHash = _hashStoredSkills(app);

        bytes32 digest = _hashTypedDataV4(keccak256(abi.encode(
            APPROVE_PATRON_APPLICATION_TYPEHASH,
            params.applicationId,
            app.applicant,
            skillsHash,
            params.signer,
            params.signatureDeadline
        )));
        _requireSigner(digest, directorSignature, params.signer);
        _consumeDigest(digest);

        // Mint
        tokenId = ++nextTokenId;
        _mint(app.applicant, tokenId);

        // Store immutable skills
        for (uint256 i = 0; i < app.skillCount; i++) {
            bytes32 skillId = app.proposedSkills[i];
            tokenSkills[tokenId].push(skillId);
            hasSkill[tokenId][skillId] = true;
        }

        // Update application
        app.status = ApplicationStatus.Minted;
        app.tokenId = tokenId;

        // Track multiple Patrons per wallet
        patronTokensByOwner[app.applicant].push(tokenId);

        emit PatronMinted(params.applicationId, tokenId, app.applicant, params.signer);
    }

    // ──────────────────────── Reject Application ──────────────────────

    /**
     * @notice An HN Director rejects a pending application. No token is minted.
     * @param params Rejection parameters (applicationId, director signer, deadline).
     * @param directorSignature EIP-712 signature from the HN Director.
     */
    function rejectApplication(
        RejectApplicationParams calldata params,
        bytes calldata directorSignature
    ) external {
        PatronApplication storage app = applications[params.applicationId];
        if (app.status != ApplicationStatus.Pending) {
            revert ApplicationNotPending(params.applicationId);
        }

        _requireNonZeroSigner(params.signer);
        _requireDeadline(params.signatureDeadline);
        _requireHNDirector(params.signer);

        bytes32 digest = _hashTypedDataV4(keccak256(abi.encode(
            REJECT_PATRON_APPLICATION_TYPEHASH,
            params.applicationId,
            app.applicant,
            params.signer,
            params.signatureDeadline
        )));
        _requireSigner(digest, directorSignature, params.signer);
        _consumeDigest(digest);

        app.status = ApplicationStatus.Rejected;

        emit PatronApplicationRejected(params.applicationId, app.applicant, params.signer);
    }

    // ──────────────────────── Revoke / Burn ───────────────────────────

    /**
     * @notice An HN Director burns/revokes a Patron SBT.
     * @param params Revocation parameters (tokenId, director signer, nonce, deadline).
     * @param directorSignature EIP-712 signature from the HN Director.
     */
    function revokePatron(
        RevokePatronParams calldata params,
        bytes calldata directorSignature
    ) external {
        _requireTokenExists(params.tokenId);
        _requireNonZeroSigner(params.signer);
        _requireDeadline(params.signatureDeadline);
        _requireHNDirector(params.signer);

        if (params.nonce != hnDirectorNonces[params.signer]) {
            revert NonceMismatch(hnDirectorNonces[params.signer], params.nonce);
        }

        address patronOwner = ownerOf(params.tokenId);

        bytes32 digest = _hashTypedDataV4(keccak256(abi.encode(
            REVOKE_PATRON_TYPEHASH,
            params.tokenId,
            patronOwner,
            params.signer,
            params.nonce,
            params.signatureDeadline
        )));
        _requireSigner(digest, directorSignature, params.signer);
        _consumeDigest(digest);

        hnDirectorNonces[params.signer]++;
        _burn(params.tokenId);

        emit PatronRevoked(params.tokenId, patronOwner, params.signer);
    }

    // ──────────────────────── Skill Registry ──────────────────────────

    /**
     * @notice An HN Director activates or deactivates a canonical skill.
     *         Deactivating a skill does NOT alter already-minted Patron SBTs.
     * @param params Skill status parameters.
     * @param signature EIP-712 signature from the HN Director.
     */
    function setSkillStatusByHNDirector(
        SetSkillStatusParams calldata params,
        bytes calldata signature
    ) external {
        if (params.skillId == bytes32(0)) revert InvalidSkill(params.skillId);
        _requireNonZeroSigner(params.signer);
        _requireDeadline(params.signatureDeadline);
        _requireHNDirector(params.signer);

        if (params.nonce != hnDirectorNonces[params.signer]) {
            revert NonceMismatch(hnDirectorNonces[params.signer], params.nonce);
        }

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

    // ──────────────────────── Read Functions ──────────────────────────

    /**
     * @notice Returns the skill list for a currently existing Patron token.
     * @param tokenId The Patron SBT token ID.
     * @return The array of bytes32 skill identifiers.
     */
    function getSkills(uint256 tokenId) external view returns (bytes32[] memory) {
        _requireTokenExists(tokenId);
        return tokenSkills[tokenId];
    }

    /**
     * @notice Returns all application IDs submitted by an applicant.
     * @param applicant The applicant address.
     * @return Array of application IDs.
     */
    function getApplicantApplications(address applicant) external view returns (bytes32[] memory) {
        return applicantApplicationIds[applicant];
    }

    /**
     * @notice Returns the proposed skills for an application. This explicit
     *         getter is provided because Solidity's auto-generated getter for a
     *         struct that contains a dynamic array does not return the array.
     * @param applicationId The application identifier.
     * @return skills Array of proposed skill IDs.
     */
    function getApplicationSkills(bytes32 applicationId) external view returns (bytes32[] memory skills) {
        PatronApplication storage app = applications[applicationId];
        uint256 n = app.skillCount;
        skills = new bytes32[](n);
        for (uint256 i = 0; i < n; i++) {
            skills[i] = app.proposedSkills[i];
        }
    }

    /**
     * @notice Returns all Patron token IDs ever associated with an owner.
     * @dev    May contain burned token IDs. Use `isActivePatron()` to filter.
     * @param owner The wallet address.
     * @return Array of token IDs (including potentially burned ones).
     */
    function getPatronTokens(address owner) external view returns (uint256[] memory) {
        return patronTokensByOwner[owner];
    }

    /**
     * @notice Checks whether a Patron token currently exists (has not been burned).
     * @param tokenId The token ID to check.
     * @return True if the token currently exists as an active ERC-721.
     */
    function isActivePatron(uint256 tokenId) public view returns (bool) {
        return _ownerOf(tokenId) != address(0);
    }

    /**
     * @notice Returns only the currently active (non-burned) Patron tokens for
     *         an owner. Iterates the full historical list and filters.
     * @param owner The wallet address.
     * @return activeTokens Array of active token IDs.
     */
    function getActivePatronTokens(address owner) external view returns (uint256[] memory activeTokens) {
        uint256[] storage all = patronTokensByOwner[owner];
        uint256 count;
        for (uint256 i = 0; i < all.length; i++) {
            if (_ownerOf(all[i]) != address(0)) {
                count++;
            }
        }
        activeTokens = new uint256[](count);
        uint256 idx;
        for (uint256 i = 0; i < all.length; i++) {
            if (_ownerOf(all[i]) != address(0)) {
                activeTokens[idx++] = all[i];
            }
        }
    }

    /**
     * @notice Returns an empty string. Patron profile metadata is stored
     *         off-chain in GitHub JSON.
     * @param tokenId The token ID (must exist).
     * @return Empty string.
     */
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireTokenExists(tokenId);
        return "";
    }

    // ──────────────────────── SBT Overrides ───────────────────────────

    /**
     * @dev Restricts ERC-721 transfers to mint (from zero) and burn (to zero).
     */
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

    // ──────────────────────── Internal Helpers ─────────────────────────

    function _requireDeadline(uint256 deadline) internal view {
        if (deadline < block.timestamp) revert DeadlineExpired();
    }

    function _requireNonZeroSigner(address signer) internal pure {
        if (signer == address(0)) revert ZeroSigner();
    }

    function _requireTokenExists(uint256 tokenId) internal view {
        if (_ownerOf(tokenId) == address(0)) revert TokenDoesNotExist(tokenId);
    }

    function _requireHNDirector(address signer) internal view {
        if (!ISafe(hnDirectorsSafe).isOwner(signer)) revert NotHNDirector(signer);
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

    function _hashStoredSkills(PatronApplication storage app) internal view returns (bytes32) {
        bytes32[] memory skills = new bytes32[](app.skillCount);
        for (uint256 i = 0; i < app.skillCount; i++) {
            skills[i] = app.proposedSkills[i];
        }
        return keccak256(abi.encodePacked(skills));
    }

    function _validateSkillList(bytes32[] calldata skillIds) internal view {
        for (uint256 i = 0; i < skillIds.length; i++) {
            bytes32 skillId = skillIds[i];
            if (!validSkill[skillId]) revert InvalidSkill(skillId);
            for (uint256 j = i + 1; j < skillIds.length; j++) {
                if (skillIds[j] == skillId) revert DuplicateSkill(skillId);
            }
        }
    }
}
