// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v5.0.2/contracts/access/Ownable.sol";
import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v5.0.2/contracts/utils/cryptography/EIP712.sol";
import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v5.0.2/contracts/utils/cryptography/ECDSA.sol";

// =============================================================================
//  Minimal interfaces for external contracts
// =============================================================================

/// @notice Interface for the HubsNetworkBadgeSBT contract that tracks approved hubs.
interface IHubsNetworkBadgeSBT {
    function isApprovedHub(address hubSafe) external view returns (bool);
    function hasBadge(address hubSafe) external view returns (bool);
    function badgeOf(address hubSafe) external view returns (uint256);
}

/// @notice Minimal interface for Gnosis Safe multisig ownership queries.
interface ISafe {
    function isOwner(address owner) external view returns (bool);
}

/// @notice Interface for the PilgrimPassportSBT contract (v4).
interface IPilgrimPassportSBT {
    struct AttestSkillsParams {
        uint256 tokenId;
        address hubSafe;
        address signer;
        bytes32[] skillIds;
        uint256 signatureDeadline;
    }

    function validSkill(bytes32 skillId) external view returns (bool);
    function tokenOf(address owner) external view returns (uint256);
    function ownerOf(uint256 tokenId) external view returns (address);
    function getSkills(uint256 tokenId) external view returns (bytes32[] memory);
    function hasSkill(uint256 tokenId, bytes32 skillId) external view returns (bool);

    function attestSkills(
        AttestSkillsParams calldata params,
        bytes calldata hubSignature
    ) external;
}

// =============================================================================
//  HubsNetworkResidencies
//
//  Manages on-chain residency programmes for the Hubs Network. Approved hubs
//  create residencies with required skills, pilgrims apply, hubs select
//  participants, and upon completion hubs award skill attestations via the
//  PilgrimPassportSBT contract.
//
//  All state-changing operations are authorised via EIP-712 typed signatures
//  from the relevant hub Safe owner or pilgrim, enabling gasless / relayed
//  transactions.
// =============================================================================
contract HubsNetworkResidencies is Ownable, EIP712 {
    using ECDSA for bytes32;

    // =========================================================================
    //  Constants
    // =========================================================================

    /// @notice Maximum number of skills that can be associated with a residency.
    uint256 public constant MAX_RESIDENCY_SKILLS = 10;

    /// @notice Maximum number of skills that can be awarded to a pilgrim.
    uint256 public constant MAX_AWARD_SKILLS = 10;

    /// @notice Maximum number of pilgrims that can be selected for a residency.
    uint256 public constant MAX_SELECTED_PILGRIMS = 20;

    // =========================================================================
    //  EIP-712 Type Hashes
    // =========================================================================

    /// @dev EIP-712 typehash for creating a new residency programme.
    ///      CreateResidency(address hubSafe,address signer,bytes32 metadataHash,bytes32 skillsHash,uint64 applicationDeadline,uint64 startDate,uint64 endDate,bool isCalendarBound,uint256 nonce,uint256 signatureDeadline)
    bytes32 private constant CREATE_RESIDENCY_TYPEHASH = keccak256(
        "CreateResidency(address hubSafe,address signer,bytes32 metadataHash,bytes32 skillsHash,uint64 applicationDeadline,uint64 startDate,uint64 endDate,bool isCalendarBound,uint256 nonce,uint256 signatureDeadline)"
    );

    /// @dev EIP-712 typehash for a pilgrim applying to a residency.
    ///      ApplyToResidency(uint256 residencyId,address pilgrim,uint256 pilgrimPassportTokenId,bytes32 matchingSkill,uint256 nonce,uint256 signatureDeadline)
    bytes32 private constant APPLY_TO_RESIDENCY_TYPEHASH = keccak256(
        "ApplyToResidency(uint256 residencyId,address pilgrim,uint256 pilgrimPassportTokenId,bytes32 matchingSkill,uint256 nonce,uint256 signatureDeadline)"
    );

    /// @dev EIP-712 typehash for selecting pilgrims and closing applications.
    ///      SelectPilgrims(uint256 residencyId,address signer,bytes32 pilgrimIdsHash,uint256 nonce,uint256 signatureDeadline)
    bytes32 private constant SELECT_PILGRIMS_TYPEHASH = keccak256(
        "SelectPilgrims(uint256 residencyId,address signer,bytes32 pilgrimIdsHash,uint256 nonce,uint256 signatureDeadline)"
    );

    /// @dev EIP-712 typehash for awarding skills to a selected pilgrim.
    ///      AwardPilgrim(uint256 residencyId,uint256 pilgrimPassportTokenId,address signer,bytes32 skillIdsHash,uint256 nonce,uint256 signatureDeadline)
    bytes32 private constant AWARD_PILGRIM_TYPEHASH = keccak256(
        "AwardPilgrim(uint256 residencyId,uint256 pilgrimPassportTokenId,address signer,bytes32 skillIdsHash,uint256 nonce,uint256 signatureDeadline)"
    );

    /// @dev EIP-712 typehash for cancelling an open residency.
    ///      CancelResidency(uint256 residencyId,address signer,uint256 nonce,uint256 signatureDeadline)
    bytes32 private constant CANCEL_RESIDENCY_TYPEHASH = keccak256(
        "CancelResidency(uint256 residencyId,address signer,uint256 nonce,uint256 signatureDeadline)"
    );

    // =========================================================================
    //  Enums & Structs
    // =========================================================================

    /// @notice Lifecycle status of a residency programme.
    enum ResidencyStatus { None, Open, Closed, Cancelled }

    /// @notice On-chain representation of a residency programme.
    struct Residency {
        uint256 id;
        address hubSafe;
        string metadataURI;
        bytes32 metadataHash;
        uint64 createdAt;
        uint64 applicationDeadline;
        uint64 startDate;
        uint64 endDate;
        bool isCalendarBound;
        uint8 skillCount;
        ResidencyStatus status;
    }

    /// @notice Parameters for creating a new residency (passed by the caller).
    struct CreateResidencyParams {
        address hubSafe;
        address signer;
        string metadataURI;
        bytes32 metadataHash;
        bytes32[] skills;
        uint64 applicationDeadline;
        uint64 startDate;
        uint64 endDate;
        bool isCalendarBound;
        uint256 nonce;
        uint256 signatureDeadline;
    }

    /// @notice Parameters for a pilgrim applying to a residency.
    struct ApplyToResidencyParams {
        uint256 residencyId;
        address pilgrim;
        uint256 pilgrimPassportTokenId;
        bytes32 matchingSkill;
        uint256 nonce;
        uint256 signatureDeadline;
    }

    /// @notice Parameters for selecting pilgrims and closing a residency.
    struct SelectPilgrimsParams {
        uint256 residencyId;
        address signer;
        uint256[] pilgrimPassportTokenIds;
        uint256 nonce;
        uint256 signatureDeadline;
    }

    /// @notice Parameters for awarding skill attestations to a selected pilgrim.
    struct AwardPilgrimParams {
        uint256 residencyId;
        uint256 pilgrimPassportTokenId;
        address signer;
        bytes32[] skillIds;
        uint256 nonce;
        uint256 signatureDeadline;
    }

    // =========================================================================
    //  Custom Errors
    // =========================================================================

    error ZeroAddress();
    error NotApprovedHub(address hubSafe);
    error NotSafeOwner(address safe, address signer);
    error InvalidSkillCount(uint256 count);
    error InvalidSkill(bytes32 skillId);
    error DuplicateSkill(bytes32 skillId);
    error DeadlineExpired();
    error InvalidSignature();
    error SignatureAlreadyUsed();
    error NonceMismatch(uint256 expected, uint256 provided);
    error ResidencyNotFound(uint256 residencyId);
    error ResidencyNotOpen(uint256 residencyId);
    error ResidencyNotClosed(uint256 residencyId);
    error ApplicationDeadlineNotPassed(uint256 residencyId);
    error ApplicationDeadlinePassed(uint256 residencyId);
    error InvalidPilgrim();
    error InvalidPassportTokenId();
    error PassportMismatch(address pilgrim, uint256 tokenId);
    error AlreadyApplied(uint256 residencyId, uint256 tokenId);
    error SkillNotInResidency(bytes32 skillId);
    error PilgrimLacksSkill(uint256 tokenId, bytes32 skillId);
    error InvalidSelectionCount(uint256 count);
    error PilgrimNotApplied(uint256 residencyId, uint256 tokenId);
    error DuplicateSelection(uint256 tokenId);
    error PilgrimNotSelected(uint256 residencyId, uint256 tokenId);
    error AlreadyAwarded(uint256 residencyId, uint256 tokenId);
    error InvalidCalendarDates();

    // =========================================================================
    //  Events
    // =========================================================================

    /// @notice Emitted when a new residency programme is created.
    event ResidencyCreated(
        uint256 indexed residencyId,
        address indexed hubSafe,
        address indexed signer,
        string metadataURI,
        bytes32 metadataHash
    );

    /// @notice Emitted when a pilgrim applies to a residency.
    event ResidencyApplied(
        uint256 indexed residencyId,
        uint256 indexed pilgrimPassportTokenId,
        address indexed pilgrim,
        bytes32 matchingSkill
    );

    /// @notice Emitted when a residency's application period is closed.
    event ResidencyClosed(
        uint256 indexed residencyId,
        address indexed hubSafe,
        address indexed signer
    );

    /// @notice Emitted for each pilgrim selected for a residency.
    event PilgrimSelected(
        uint256 indexed residencyId,
        uint256 indexed pilgrimPassportTokenId
    );

    /// @notice Emitted when a pilgrim is awarded skill attestations.
    event PilgrimAwarded(
        uint256 indexed residencyId,
        uint256 indexed pilgrimPassportTokenId,
        address indexed hubSafe,
        address signer,
        bytes32[] skillIds
    );

    /// @notice Emitted when a residency is cancelled.
    event ResidencyCancelled(
        uint256 indexed residencyId,
        address indexed hubSafe,
        address indexed signer
    );

    // =========================================================================
    //  State Variables
    // =========================================================================

    /// @notice Reference to the HubsNetworkBadgeSBT contract.
    IHubsNetworkBadgeSBT public hubBadgeSBT;

    /// @notice Reference to the PilgrimPassportSBT contract.
    IPilgrimPassportSBT public pilgrimPassportSBT;

    /// @dev Auto-incrementing residency identifier.
    uint256 private _nextResidencyId = 1;

    /// @dev Residency id → Residency struct.
    mapping(uint256 => Residency) private residencies;

    /// @dev Residency id → ordered list of required skill ids.
    mapping(uint256 => bytes32[]) private residencySkills;

    /// @dev Residency id → skill id → whether the skill is required.
    mapping(uint256 => mapping(bytes32 => bool)) public isResidencySkill;

    /// @dev Hub Safe address → list of residency ids created by that hub.
    mapping(address => uint256[]) private hubResidencyIds;

    /// @dev Residency id → ordered list of applicant passport token ids.
    mapping(uint256 => uint256[]) private residencyApplicants;

    /// @dev Residency id → passport token id → whether the pilgrim has applied.
    mapping(uint256 => mapping(uint256 => bool)) public hasApplied;

    /// @dev Residency id → ordered list of selected passport token ids.
    mapping(uint256 => uint256[]) private selectedPilgrims;

    /// @dev Residency id → passport token id → whether the pilgrim is selected.
    mapping(uint256 => mapping(uint256 => bool)) public isSelected;

    /// @dev Residency id → passport token id → whether the pilgrim has been awarded.
    mapping(uint256 => mapping(uint256 => bool)) public isAwarded;

    /// @dev Signer address → sequential nonce for replay protection.
    mapping(address => uint256) public signerNonces;

    /// @dev EIP-712 digest → whether it has been consumed.
    mapping(bytes32 => bool) public usedDigests;

    // =========================================================================
    //  Constructor
    // =========================================================================

    /// @notice Deploys the residencies contract.
    /// @param hubBadgeSBTAddress Address of the deployed HubsNetworkBadgeSBT.
    /// @param pilgrimPassportSBTAddress Address of the deployed PilgrimPassportSBT.
    constructor(
        address hubBadgeSBTAddress,
        address pilgrimPassportSBTAddress
    ) Ownable(msg.sender) EIP712("HubsNetworkResidencies", "1") {
        _requireNonZero(hubBadgeSBTAddress);
        _requireNonZero(pilgrimPassportSBTAddress);
        hubBadgeSBT = IHubsNetworkBadgeSBT(hubBadgeSBTAddress);
        pilgrimPassportSBT = IPilgrimPassportSBT(pilgrimPassportSBTAddress);
    }

    // =========================================================================
    //  Internal Helpers
    // =========================================================================

    /// @dev Reverts if `addr` is the zero address.
    function _requireNonZero(address addr) internal pure {
        if (addr == address(0)) revert ZeroAddress();
    }

    /// @dev Reverts if `deadline` is in the past.
    function _requireDeadline(uint256 deadline) internal view {
        if (deadline < block.timestamp) revert DeadlineExpired();
    }

    /// @dev Recovers the signer from `digest` + `signature` and reverts if it
    ///      does not match `expectedSigner`.
    function _verifySigner(bytes32 digest, bytes calldata signature, address expectedSigner) internal pure {
        if (ECDSA.recover(digest, signature) != expectedSigner) revert InvalidSignature();
    }

    /// @dev Marks `digest` as consumed; reverts if already used.
    function _consumeDigest(bytes32 digest) internal {
        if (usedDigests[digest]) revert SignatureAlreadyUsed();
        usedDigests[digest] = true;
    }

    /// @dev Consumes the next expected nonce for `signer`; reverts on mismatch.
    function _consumeNonce(address signer, uint256 nonce) internal {
        if (signerNonces[signer] != nonce) revert NonceMismatch(signerNonces[signer], nonce);
        signerNonces[signer]++;
    }

    /// @dev Validates that `hubSafe` is an approved hub and `signer` is an owner
    ///      of that Safe, and that the signature deadline has not expired.
    function _validateHubSigner(address hubSafe, address signer, uint256 signatureDeadline) internal view {
        _requireNonZero(hubSafe);
        _requireNonZero(signer);
        _requireDeadline(signatureDeadline);
        if (!hubBadgeSBT.isApprovedHub(hubSafe)) revert NotApprovedHub(hubSafe);
        if (!ISafe(hubSafe).isOwner(signer)) revert NotSafeOwner(hubSafe, signer);
    }

    /// @dev Returns the Residency storage pointer for `residencyId`; reverts if
    ///      the residency does not exist (status == None).
    function _requireResidencyExists(uint256 residencyId) internal view returns (Residency storage) {
        Residency storage r = residencies[residencyId];
        if (r.status == ResidencyStatus.None) revert ResidencyNotFound(residencyId);
        return r;
    }

    // =========================================================================
    //  Internal Digest Builders (avoid stack-too-deep in public functions)
    // =========================================================================

    /// @dev Encodes the first half of the CreateResidency struct hash.
    function _encodeCreateFirst(CreateResidencyParams calldata params, bytes32 skillsHash) internal pure returns (bytes memory) {
        return abi.encode(
            CREATE_RESIDENCY_TYPEHASH,
            params.hubSafe,
            params.signer,
            params.metadataHash,
            skillsHash,
            params.applicationDeadline
        );
    }

    /// @dev Encodes the second half of the CreateResidency struct hash.
    function _encodeCreateSecond(CreateResidencyParams calldata params) internal pure returns (bytes memory) {
        return abi.encode(
            params.startDate,
            params.endDate,
            params.isCalendarBound,
            params.nonce,
            params.signatureDeadline
        );
    }

    /// @dev Builds the EIP-712 digest for CreateResidency.
    ///      Split across helper functions to avoid stack-too-deep.
    function _buildCreateResidencyDigest(CreateResidencyParams calldata params) internal view returns (bytes32) {
        bytes32 skillsHash = keccak256(abi.encodePacked(params.skills));
        bytes32 structHash = keccak256(bytes.concat(
            _encodeCreateFirst(params, skillsHash),
            _encodeCreateSecond(params)
        ));
        return _hashTypedDataV4(structHash);
    }

    // =========================================================================
    //  Function 1: createResidency
    // =========================================================================

    /// @dev Validates all business rules for residency creation.
    function _validateCreateResidency(CreateResidencyParams calldata params) internal view {
        _validateHubSigner(params.hubSafe, params.signer, params.signatureDeadline);

        uint256 skillCount = params.skills.length;
        if (skillCount < 1 || skillCount > MAX_RESIDENCY_SKILLS) {
            revert InvalidSkillCount(skillCount);
        }

        for (uint256 i = 0; i < skillCount; i++) {
            bytes32 skillId = params.skills[i];
            if (!pilgrimPassportSBT.validSkill(skillId)) revert InvalidSkill(skillId);
            for (uint256 j = 0; j < i; j++) {
                if (params.skills[j] == skillId) revert DuplicateSkill(skillId);
            }
        }

        if (params.applicationDeadline <= block.timestamp) revert ApplicationDeadlinePassed(0);

        if (params.isCalendarBound) {
            if (params.startDate == 0 || params.endDate <= params.startDate) {
                revert InvalidCalendarDates();
            }
        } else {
            if (params.startDate != 0 || params.endDate != 0) {
                revert InvalidCalendarDates();
            }
        }
    }

    /// @dev Stores a new residency and its skills. Returns the new residency id.
    function _storeResidency(CreateResidencyParams calldata params) internal returns (uint256 residencyId) {
        residencyId = _nextResidencyId++;

        Residency storage r = residencies[residencyId];
        r.id = residencyId;
        r.hubSafe = params.hubSafe;
        r.metadataURI = params.metadataURI;
        r.metadataHash = params.metadataHash;
        r.createdAt = uint64(block.timestamp);
        r.applicationDeadline = params.applicationDeadline;
        r.startDate = params.startDate;
        r.endDate = params.endDate;
        r.isCalendarBound = params.isCalendarBound;
        r.skillCount = uint8(params.skills.length);
        r.status = ResidencyStatus.Open;

        for (uint256 i = 0; i < params.skills.length; i++) {
            bytes32 skillId = params.skills[i];
            residencySkills[residencyId].push(skillId);
            isResidencySkill[residencyId][skillId] = true;
        }

        hubResidencyIds[params.hubSafe].push(residencyId);
    }

    /// @notice Creates a new residency programme on behalf of an approved hub.
    /// @dev The hub Safe owner signs the EIP-712 typed data off-chain; a relayer
    ///      or the signer themselves submits the transaction.
    /// @param params The residency creation parameters.
    /// @param hubSignature EIP-712 signature from a Safe owner of `params.hubSafe`.
    /// @return residencyId The id of the newly created residency.
    function createResidency(
        CreateResidencyParams calldata params,
        bytes calldata hubSignature
    ) external returns (uint256 residencyId) {
        // 1. Validate all business rules
        _validateCreateResidency(params);

        // 2. Consume nonce
        _consumeNonce(params.signer, params.nonce);

        // 3. Build EIP-712 digest, verify signature, consume digest
        bytes32 digest = _buildCreateResidencyDigest(params);
        _verifySigner(digest, hubSignature, params.signer);
        _consumeDigest(digest);

        // 4. Store residency
        residencyId = _storeResidency(params);

        // 5. Emit event
        emit ResidencyCreated(residencyId, params.hubSafe, params.signer, params.metadataURI, params.metadataHash);
    }

    // =========================================================================
    //  Function 2: applyToResidency
    // =========================================================================

    /// @notice Allows a pilgrim to apply to an open residency.
    /// @dev The pilgrim signs the EIP-712 typed data off-chain.
    /// @param params The application parameters.
    /// @param pilgrimSignature EIP-712 signature from the pilgrim.
    function applyToResidency(
        ApplyToResidencyParams calldata params,
        bytes calldata pilgrimSignature
    ) external {
        // 1. Residency must exist
        Residency storage r = _requireResidencyExists(params.residencyId);

        // 2. Residency must be open
        if (r.status != ResidencyStatus.Open) revert ResidencyNotOpen(params.residencyId);

        // 3. Application deadline must not have passed
        if (block.timestamp > r.applicationDeadline) revert ApplicationDeadlinePassed(params.residencyId);

        // 4. Pilgrim address must be non-zero
        if (params.pilgrim == address(0)) revert InvalidPilgrim();

        // 5. Passport token id must be non-zero
        if (params.pilgrimPassportTokenId == 0) revert InvalidPassportTokenId();

        // 6. tokenOf(pilgrim) must match the provided token id
        if (pilgrimPassportSBT.tokenOf(params.pilgrim) != params.pilgrimPassportTokenId) {
            revert PassportMismatch(params.pilgrim, params.pilgrimPassportTokenId);
        }

        // 7. ownerOf(tokenId) must match the pilgrim
        if (pilgrimPassportSBT.ownerOf(params.pilgrimPassportTokenId) != params.pilgrim) {
            revert PassportMismatch(params.pilgrim, params.pilgrimPassportTokenId);
        }

        // 8. Must not have already applied
        if (hasApplied[params.residencyId][params.pilgrimPassportTokenId]) {
            revert AlreadyApplied(params.residencyId, params.pilgrimPassportTokenId);
        }

        // 9. Matching skill must be one of the residency's required skills
        if (!isResidencySkill[params.residencyId][params.matchingSkill]) {
            revert SkillNotInResidency(params.matchingSkill);
        }

        // 10. Pilgrim must possess the matching skill
        if (!pilgrimPassportSBT.hasSkill(params.pilgrimPassportTokenId, params.matchingSkill)) {
            revert PilgrimLacksSkill(params.pilgrimPassportTokenId, params.matchingSkill);
        }

        // 11. Signature deadline must be valid
        _requireDeadline(params.signatureDeadline);

        // 12. Consume nonce
        _consumeNonce(params.pilgrim, params.nonce);

        // 13. Build EIP-712 digest
        bytes32 structHash = keccak256(abi.encode(
            APPLY_TO_RESIDENCY_TYPEHASH,
            params.residencyId,
            params.pilgrim,
            params.pilgrimPassportTokenId,
            params.matchingSkill,
            params.nonce,
            params.signatureDeadline
        ));
        bytes32 digest = _hashTypedDataV4(structHash);

        // 14. Verify signature
        _verifySigner(digest, pilgrimSignature, params.pilgrim);

        // 15. Consume digest
        _consumeDigest(digest);

        // 16. Record application
        hasApplied[params.residencyId][params.pilgrimPassportTokenId] = true;

        // 17. Track applicant
        residencyApplicants[params.residencyId].push(params.pilgrimPassportTokenId);

        // 18. Emit event
        emit ResidencyApplied(params.residencyId, params.pilgrimPassportTokenId, params.pilgrim, params.matchingSkill);
    }

    // =========================================================================
    //  Function 3: selectPilgrimsAndClose
    // =========================================================================

    /// @notice Selects pilgrims for a residency and closes applications.
    /// @dev Can only be called after the application deadline has passed.
    /// @param params The selection parameters.
    /// @param hubSignature EIP-712 signature from a Safe owner of the residency's hub.
    function selectPilgrimsAndClose(
        SelectPilgrimsParams calldata params,
        bytes calldata hubSignature
    ) external {
        // 1. Residency must exist
        Residency storage r = _requireResidencyExists(params.residencyId);

        // 2. Residency must be open
        if (r.status != ResidencyStatus.Open) revert ResidencyNotOpen(params.residencyId);

        // 3. Application deadline must have passed
        if (block.timestamp <= r.applicationDeadline) revert ApplicationDeadlineNotPassed(params.residencyId);

        // 4. Validate hub signer
        _validateHubSigner(r.hubSafe, params.signer, params.signatureDeadline);

        // 5. Consume nonce
        _consumeNonce(params.signer, params.nonce);

        // 6. Validate selection count
        uint256 selectionCount = params.pilgrimPassportTokenIds.length;
        if (selectionCount < 1 || selectionCount > MAX_SELECTED_PILGRIMS) {
            revert InvalidSelectionCount(selectionCount);
        }

        // 7. Build EIP-712 digest
        bytes32 pilgrimIdsHash = keccak256(abi.encodePacked(params.pilgrimPassportTokenIds));
        bytes32 structHash = keccak256(abi.encode(
            SELECT_PILGRIMS_TYPEHASH,
            params.residencyId,
            params.signer,
            pilgrimIdsHash,
            params.nonce,
            params.signatureDeadline
        ));
        bytes32 digest = _hashTypedDataV4(structHash);

        // 8. Verify signature
        _verifySigner(digest, hubSignature, params.signer);

        // 9. Consume digest
        _consumeDigest(digest);

        // 10. Process each selected pilgrim
        for (uint256 i = 0; i < selectionCount; i++) {
            uint256 tokenId = params.pilgrimPassportTokenIds[i];

            // Must have applied
            if (!hasApplied[params.residencyId][tokenId]) {
                revert PilgrimNotApplied(params.residencyId, tokenId);
            }

            // Must not be a duplicate selection
            if (isSelected[params.residencyId][tokenId]) {
                revert DuplicateSelection(tokenId);
            }

            isSelected[params.residencyId][tokenId] = true;
            selectedPilgrims[params.residencyId].push(tokenId);

            emit PilgrimSelected(params.residencyId, tokenId);
        }

        // 11. Close the residency
        r.status = ResidencyStatus.Closed;

        // 12. Emit event
        emit ResidencyClosed(params.residencyId, r.hubSafe, params.signer);
    }

    // =========================================================================
    //  Function 4: awardPilgrim
    // =========================================================================

    /// @notice Awards skill attestations to a selected pilgrim upon residency
    ///         completion. Calls `attestSkills` on the PilgrimPassportSBT contract.
    /// @param params The award parameters.
    /// @param residencyHubSignature EIP-712 signature for this contract's AwardPilgrim type.
    /// @param passportHubSignature EIP-712 signature for the PilgrimPassportSBT AttestSkills type.
    function awardPilgrim(
        AwardPilgrimParams calldata params,
        bytes calldata residencyHubSignature,
        bytes calldata passportHubSignature
    ) external {
        // 1. Residency must exist
        Residency storage r = _requireResidencyExists(params.residencyId);

        // 2. Residency must be closed
        if (r.status != ResidencyStatus.Closed) revert ResidencyNotClosed(params.residencyId);

        // 3. Validate hub signer
        _validateHubSigner(r.hubSafe, params.signer, params.signatureDeadline);

        // 4. Consume nonce
        _consumeNonce(params.signer, params.nonce);

        // 5. Pilgrim must be selected
        if (!isSelected[params.residencyId][params.pilgrimPassportTokenId]) {
            revert PilgrimNotSelected(params.residencyId, params.pilgrimPassportTokenId);
        }

        // 6. Must not already be awarded
        if (isAwarded[params.residencyId][params.pilgrimPassportTokenId]) {
            revert AlreadyAwarded(params.residencyId, params.pilgrimPassportTokenId);
        }

        // 7. Validate skill count
        uint256 awardSkillCount = params.skillIds.length;
        if (awardSkillCount < 1 || awardSkillCount > MAX_AWARD_SKILLS) {
            revert InvalidSkillCount(awardSkillCount);
        }

        // 8. Validate each skill is in the residency and check for duplicates
        for (uint256 i = 0; i < awardSkillCount; i++) {
            bytes32 skillId = params.skillIds[i];
            if (!isResidencySkill[params.residencyId][skillId]) {
                revert SkillNotInResidency(skillId);
            }
            // Check for duplicates via nested loop
            for (uint256 j = 0; j < i; j++) {
                if (params.skillIds[j] == skillId) revert DuplicateSkill(skillId);
            }
        }

        // 9. Build EIP-712 digest for this contract
        bytes32 skillIdsHash = keccak256(abi.encodePacked(params.skillIds));
        bytes32 structHash = keccak256(abi.encode(
            AWARD_PILGRIM_TYPEHASH,
            params.residencyId,
            params.pilgrimPassportTokenId,
            params.signer,
            skillIdsHash,
            params.nonce,
            params.signatureDeadline
        ));
        bytes32 digest = _hashTypedDataV4(structHash);

        // 10. Verify signature against this contract's domain
        _verifySigner(digest, residencyHubSignature, params.signer);

        // 11. Consume digest
        _consumeDigest(digest);

        // 12. Call attestSkills on PilgrimPassportSBT
        //     Build the AttestSkillsParams in memory; Solidity handles the
        //     memory → calldata conversion automatically for external calls.
        IPilgrimPassportSBT.AttestSkillsParams memory attestParams = IPilgrimPassportSBT.AttestSkillsParams({
            tokenId: params.pilgrimPassportTokenId,
            hubSafe: r.hubSafe,
            signer: params.signer,
            skillIds: params.skillIds,
            signatureDeadline: params.signatureDeadline
        });
        pilgrimPassportSBT.attestSkills(attestParams, passportHubSignature);

        // 13. Mark as awarded
        isAwarded[params.residencyId][params.pilgrimPassportTokenId] = true;

        // 14. Emit event
        emit PilgrimAwarded(
            params.residencyId,
            params.pilgrimPassportTokenId,
            r.hubSafe,
            params.signer,
            params.skillIds
        );
    }

    // =========================================================================
    //  Function 5: cancelResidency
    // =========================================================================

    /// @notice Cancels an open residency programme.
    /// @param residencyId The id of the residency to cancel.
    /// @param signer The address of the hub Safe owner signing the cancellation.
    /// @param nonce The signer's current nonce.
    /// @param signatureDeadline The deadline for the signature's validity.
    /// @param hubSignature EIP-712 signature from the hub Safe owner.
    function cancelResidency(
        uint256 residencyId,
        address signer,
        uint256 nonce,
        uint256 signatureDeadline,
        bytes calldata hubSignature
    ) external {
        // 1. Residency must exist
        Residency storage r = _requireResidencyExists(residencyId);

        // 2. Residency must be open
        if (r.status != ResidencyStatus.Open) revert ResidencyNotOpen(residencyId);

        // 3. Validate hub signer
        _validateHubSigner(r.hubSafe, signer, signatureDeadline);

        // 4. Consume nonce
        _consumeNonce(signer, nonce);

        // 5. Build EIP-712 digest
        bytes32 structHash = keccak256(abi.encode(
            CANCEL_RESIDENCY_TYPEHASH,
            residencyId,
            signer,
            nonce,
            signatureDeadline
        ));
        bytes32 digest = _hashTypedDataV4(structHash);

        // 6. Verify signature
        _verifySigner(digest, hubSignature, signer);

        // 7. Consume digest
        _consumeDigest(digest);

        // 8. Cancel the residency
        r.status = ResidencyStatus.Cancelled;

        // 9. Emit event
        emit ResidencyCancelled(residencyId, r.hubSafe, signer);
    }

    // =========================================================================
    //  View / Read Functions
    // =========================================================================

    /// @notice Returns the full Residency struct for a given id.
    /// @param residencyId The residency to query.
    /// @return The Residency struct (returns a zero-initialised struct if not found).
    function getResidency(uint256 residencyId) external view returns (Residency memory) {
        return residencies[residencyId];
    }

    /// @notice Returns the list of required skill ids for a residency.
    /// @param residencyId The residency to query.
    /// @return The array of skill ids.
    function getResidencySkills(uint256 residencyId) external view returns (bytes32[] memory) {
        return residencySkills[residencyId];
    }

    /// @notice Returns all residency ids created by a given hub.
    /// @param hubSafe The hub Safe address.
    /// @return The array of residency ids.
    function getHubResidencies(address hubSafe) external view returns (uint256[] memory) {
        return hubResidencyIds[hubSafe];
    }

    /// @notice Returns all applicant passport token ids for a residency.
    /// @param residencyId The residency to query.
    /// @return The array of passport token ids.
    function getResidencyApplicants(uint256 residencyId) external view returns (uint256[] memory) {
        return residencyApplicants[residencyId];
    }

    /// @notice Returns all selected pilgrim passport token ids for a residency.
    /// @param residencyId The residency to query.
    /// @return The array of passport token ids.
    function getSelectedPilgrims(uint256 residencyId) external view returns (uint256[] memory) {
        return selectedPilgrims[residencyId];
    }

    /// @notice Checks whether a pilgrim can apply to a residency with a specific skill.
    /// @param residencyId The residency to check.
    /// @param pilgrimPassportTokenId The pilgrim's passport token id.
    /// @param skillId The skill to check.
    /// @return True if the skill is required by the residency and the pilgrim possesses it.
    function canApplyWithSkill(
        uint256 residencyId,
        uint256 pilgrimPassportTokenId,
        bytes32 skillId
    ) external view returns (bool) {
        return isResidencySkill[residencyId][skillId]
            && pilgrimPassportSBT.hasSkill(pilgrimPassportTokenId, skillId);
    }

    /// @notice Returns the total number of residencies created so far.
    /// @dev Useful for a Bulletin Board UI to enumerate all residencies (ids 1 … totalResidencies()).
    /// @return The count of residencies created.
    function totalResidencies() external view returns (uint256) {
        return _nextResidencyId - 1;
    }

    /// @notice Returns the next residency id that will be assigned.
    /// @return The next residency id.
    function nextResidencyId() external view returns (uint256) {
        return _nextResidencyId;
    }

    /// @notice Indicates whether a residency is currently accepting applications.
    /// @dev Returns `true` only when status == Open AND the application deadline
    ///      has not yet passed. This lets the UI distinguish three states:
    ///      - "open" (isApplicationOpen == true)
    ///      - "deadline passed" (status == Open but deadline < block.timestamp)
    ///      - "closed" / "cancelled" (status != Open)
    /// @param residencyId The residency to query.
    /// @return True if the residency is open and the deadline has not passed.
    function isApplicationOpen(uint256 residencyId) external view returns (bool) {
        Residency storage r = residencies[residencyId];
        return r.status == ResidencyStatus.Open && block.timestamp <= r.applicationDeadline;
    }

    /// @notice Checks whether a pilgrim has any skill matching a residency's requirements.
    /// @param residencyId The residency to check.
    /// @param pilgrimPassportTokenId The pilgrim's passport token id.
    /// @return True if the pilgrim has at least one matching skill.
    function hasAnyMatchingSkill(
        uint256 residencyId,
        uint256 pilgrimPassportTokenId
    ) external view returns (bool) {
        bytes32[] memory skills = residencySkills[residencyId];
        for (uint256 i = 0; i < skills.length; i++) {
            if (pilgrimPassportSBT.hasSkill(pilgrimPassportTokenId, skills[i])) return true;
        }
        return false;
    }
}
