// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
// =============================================================================
//  HubsNetworkBadgeSBT
//  Soulbound Token (ERC-721, non-transferable) for Hubs Network hub Safe
//  multisigs approved by the Hubs Network Directors Safe on Ethereum Sepolia.
//
//  Deployed (Sepolia): 0x16453D889f19eCB30bbc47e423DcF0F2A531Cc4B
//
//  Deploy constructor values (Sepolia):
//    hnDirectorsSafe : 0xc770755f793197C34Fd5b8F86b50d73D943C98a3
//    relayer         : 0xe09bc78d7A2479E1E542D7a1C29eE783F3871a2d
//    baseTokenURI    : https://www.hubsnetwork.org/api/badge/metadata/
// =============================================================================
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
// ---------------------------------------------------------------------------
// Minimal interface to query ownership of any Gnosis Safe multisig
// ---------------------------------------------------------------------------
interface ISafe {
   function isOwner(address owner) external view returns (bool);
}
// ---------------------------------------------------------------------------
// Contract
// ---------------------------------------------------------------------------
contract HubsNetworkBadgeSBT is ERC721, Ownable {
   // -----------------------------------------------------------------------
   // State
   // -----------------------------------------------------------------------
   /// @notice The Hubs Network Directors Safe whose owners can approve mints.
   address public hnDirectorsSafe;
   /// @notice Gas-paying relayer wallet. May submit mintBadge() but cannot
   ///         approve by itself — approval is always verified on-chain against
   ///         the Directors Safe.
   address public relayer;
   /// @dev Base URI prepended to every tokenId in tokenURI().
   string private _baseTokenURI;
   /// @dev Auto-incrementing token ID counter. Starts at 1 (0 reserved as
   ///      "no badge" sentinel in hubTokenId mapping).
   uint256 private _nextTokenId = 1;
   /// @notice Maps a hub Safe address → its badge token ID (0 = no badge).
   mapping(address => uint256) public hubTokenId;
   /// @notice Maps a token ID → the hub Safe address that holds it.
   mapping(uint256 => address) public tokenHub;
   /// @notice True if a hub Safe already holds a badge.
   mapping(address => bool) public hasBadge;
   // -----------------------------------------------------------------------
   // Events
   // -----------------------------------------------------------------------
   event BadgeMinted(
       address indexed hubSafe,
       uint256 indexed tokenId,
       address indexed approver,
       address mintedBy
   );
   event BadgeRevoked(
       address indexed hubSafe,
       uint256 indexed tokenId
   );
   event HNDirectorsSafeUpdated(address indexed oldSafe, address indexed newSafe);
   event RelayerUpdated(address indexed oldRelayer, address indexed newRelayer);
   event BaseURIUpdated(string newBaseURI);
   // -----------------------------------------------------------------------
   // Constructor
   // -----------------------------------------------------------------------
   /**
    * @param hnDirectorsSafe_  Address of the Hubs Network Directors Safe.
    * @param relayer_          Address of the gas-paying relayer wallet.
    * @param baseTokenURI_     Base URI for token metadata (e.g. IPFS gateway
    *                          or API endpoint). Token URI = baseURI + tokenId.
    *
    * The deployer becomes the initial Ownable owner. Ownership can be
    * transferred to the Directors Safe after deployment if desired.
    */
   constructor(
       address hnDirectorsSafe_,
       address relayer_,
       string memory baseTokenURI_
   )
       ERC721("Hubs Network Badge", "HNBADGE")
       Ownable(msg.sender)
   {
       require(hnDirectorsSafe_ != address(0), "SBT: zero directors safe");
       require(relayer_         != address(0), "SBT: zero relayer");
       hnDirectorsSafe = hnDirectorsSafe_;
       relayer         = relayer_;
       _baseTokenURI   = baseTokenURI_;
   }
   // -----------------------------------------------------------------------
   // Modifiers
   // -----------------------------------------------------------------------
   /// @dev Allows the call only from the relayer OR the contract owner.
   modifier onlyRelayerOrOwner() {
       require(
           msg.sender == relayer || msg.sender == owner(),
           "SBT: caller is not relayer or owner"
       );
       _;
   }
   // -----------------------------------------------------------------------
   // Core: Mint
   // -----------------------------------------------------------------------
   /**
    * @notice Mint a Soulbound Badge to a hub Safe that has been approved by
    *         an owner of the Hubs Network Directors Safe.
    *
    * @param hubSafe   The hub's Gnosis Safe address that will receive the SBT.
    * @param approver  Address that approved this hub. MUST currently be an
    *                  owner of the HN Directors Safe (verified on-chain).
    *
    * @return tokenId  The newly minted token ID.
    *
    * Security model:
    *   - msg.sender must be the relayer or the contract owner (access gate).
    *   - approver must be an owner of hnDirectorsSafe (approval gate).
    *   - These are two independent checks; the relayer cannot self-approve.
    */
   function mintBadge(
       address hubSafe,
       address approver
   )
       external
       onlyRelayerOrOwner
       returns (uint256)
   {
       // --- Input validation ---
       require(hubSafe  != address(0), "SBT: zero hub safe");
       require(approver != address(0), "SBT: zero approver");
       require(!hasBadge[hubSafe],     "SBT: hub already has badge");
       // --- Approval gate: approver must be a current owner of the Directors Safe ---
       require(
           ISafe(hnDirectorsSafe).isOwner(approver),
           "SBT: approver is not a Directors Safe owner"
       );
       // --- Mint ---
       uint256 tokenId = _nextTokenId++;
       _mint(hubSafe, tokenId);
       // --- Record mappings ---
       hubTokenId[hubSafe]  = tokenId;
       tokenHub[tokenId]    = hubSafe;
       hasBadge[hubSafe]    = true;
       emit BadgeMinted(hubSafe, tokenId, approver, msg.sender);
       return tokenId;
   }
   // -----------------------------------------------------------------------
   // Core: Revoke (burn)
   // -----------------------------------------------------------------------
   /**
    * @notice Revoke (burn) a hub's badge. Only callable by the contract owner.
    * @param hubSafe  The hub Safe whose badge should be revoked.
    */
   function revokeBadge(address hubSafe) external onlyOwner {
       require(hasBadge[hubSafe], "SBT: hub has no badge");
       uint256 tokenId = hubTokenId[hubSafe];
       // Clear mappings before burn (checks-effects-interactions)
       delete hasBadge[hubSafe];
       delete hubTokenId[hubSafe];
       delete tokenHub[tokenId];
       // Burn the token (calls _update internally; from=hubSafe, to=address(0))
       _burn(tokenId);
       emit BadgeRevoked(hubSafe, tokenId);
   }
   // -----------------------------------------------------------------------
   // Soulbound: block all transfers
   // -----------------------------------------------------------------------
   /**
    * @dev Override OpenZeppelin v5's internal _update hook.
    *      Called on every mint, burn, and transfer.
    *
    *      Soulbound rule:
    *        - Mint  (from == address(0)) → ALLOWED
    *        - Burn  (to   == address(0)) → ALLOWED  (revokeBadge)
    *        - Transfer (both non-zero)   → REVERTED
    */
   function _update(
       address to,
       uint256 tokenId,
       address auth
   )
       internal
       override
       returns (address)
   {
       address from = _ownerOf(tokenId);
       // Block transfers: from != address(0) AND to != address(0)
       require(
           from == address(0) || to == address(0),
           "SBT: token is soulbound and non-transferable"
       );
       return super._update(to, tokenId, auth);
   }
   // -----------------------------------------------------------------------
   // Token URI
   // -----------------------------------------------------------------------
   /**
    * @dev Returns _baseTokenURI so that ERC721's tokenURI() builds:
    *      baseURI + tokenId  (e.g. ".../metadata/1")
    */
   function _baseURI() internal view override returns (string memory) {
       return _baseTokenURI;
   }
   // -----------------------------------------------------------------------
   // Read helpers
   // -----------------------------------------------------------------------
   /**
    * @notice Returns the token ID of a hub Safe's badge.
    * @dev    Reverts if the hub has no badge.
    */
   function badgeOf(address hubSafe) external view returns (uint256 tokenId) {
       require(hasBadge[hubSafe], "SBT: hub has no badge");
       return hubTokenId[hubSafe];
   }
   /**
    * @notice Returns true if the hub Safe currently holds a badge.
    */
   function isApprovedHub(address hubSafe) external view returns (bool) {
       return hasBadge[hubSafe];
   }
   // -----------------------------------------------------------------------
   // Admin setters (onlyOwner)
   // -----------------------------------------------------------------------
   /**
    * @notice Update the Hubs Network Directors Safe address.
    * @param newSafe  Must be non-zero.
    */
   function setHNDirectorsSafe(address newSafe) external onlyOwner {
       require(newSafe != address(0), "SBT: zero address");
       emit HNDirectorsSafeUpdated(hnDirectorsSafe, newSafe);
       hnDirectorsSafe = newSafe;
   }
   /**
    * @notice Update the relayer wallet address.
    * @param newRelayer  Must be non-zero.
    */
   function setRelayer(address newRelayer) external onlyOwner {
       require(newRelayer != address(0), "SBT: zero address");
       emit RelayerUpdated(relayer, newRelayer);
       relayer = newRelayer;
   }
   /**
    * @notice Update the base metadata URI.
    * @param newBaseURI  New base URI string (can be empty to clear).
    */
   function setBaseURI(string calldata newBaseURI) external onlyOwner {
       _baseTokenURI = newBaseURI;
       emit BaseURIUpdated(newBaseURI);
   }
}
