// module tradeport::nft;

// use std::string::{Self, String};
// use sui::coin::{Self, Coin};
// use sui::display;
// use sui::kiosk::{Self, Kiosk, KioskOwnerCap};
// use sui::package;
// use sui::sui::SUI;
// use sui::transfer_policy::{Self, TransferPolicy};

// // kiosk::lock(kiosk, cap, nft, policy);

// const EWrongVersion: u64 = 0;
// const EExceedsMintSupply: u64 = 2;
// const ENotAuthorized: u64 = 3;
// const VERSION: u64 = 1;
// const ROYALTY_BPS: u64 = 500; // 5% royalty (500 basis points)

// // One-time witness for initializing the publisher
// public struct NFT has drop {}

// // Represents the NFT
// public struct Nft has key, store {
//     id: object::UID,
//     name: String,
//     description: String,
//     image_url: String,
//     creator: address,
//     mint_number: u64,
// }

// // Tracks NFT collection details and mint count
// public struct Collection has key, store {
//     id: object::UID,
//     version: u64,
//     mint_supply: u64,
//     minted: u64,
//     creator: address,
// }

// // Initialize the module with Display and TransferPolicy
// fun init(otw: NFT, ctx: &mut tx_context::TxContext) {
//     let publisher = package::claim(otw, ctx);

//     // Set up Display for Nft
//     let display = display::new<Nft>(&publisher, ctx);
//     display::add(&mut display, string::utf8(b"name"), string::utf8(b"{name} #{mint_number}"));
//     display::add(&mut display, string::utf8(b"description"), string::utf8(b"{description}"));
//     display::add(&mut display, string::utf8(b"image_url"), string::utf8(b"{image_url}"));
//     display::add(&mut display, string::utf8(b"creator"), string::utf8(b"{creator}"));
//     display::update_version(&mut display);
//     transfer::public_share_object(display);

//     // Set up TransferPolicy for Nft
//     let (policy, policy_cap) = transfer_policy::new<Nft>(&publisher, ctx);
//     transfer::public_share_object(policy);
//     transfer::public_transfer(policy_cap, tx_context::sender(ctx));

//     transfer::public_transfer(publisher, tx_context::sender(ctx));
// }

// // Create a new NFT collection
// public fun create_collection(mint_supply: u64, ctx: &mut tx_context::TxContext): Collection {
//     Collection {
//         id: object::new(ctx),
//         version: VERSION,
//         mint_supply,
//         minted: 0,
//         creator: tx_context::sender(ctx),
//     }
// }

// // Create a kiosk for the sender and return it with its owner cap
// public fun create_kiosk(ctx: &mut tx_context::TxContext): (Kiosk, KioskOwnerCap) {
//     kiosk::new(ctx)
// }

// public fun mint_nft(
//     collection: &mut Collection,
//     name: String,
//     description: String,
//     image_url: String,
//     kiosk: &mut Kiosk,
//     cap: &KioskOwnerCap,
//     policy: TransferPolicy<Nft>, // changed from & to value
//     ctx: &mut tx_context::TxContext,
// ) {
//     assert!(collection.version == VERSION, EWrongVersion);
//     assert!(collection.minted < collection.mint_supply, EExceedsMintSupply);

//     collection.minted = collection.minted + 1;
//     let nft = Nft {
//         id: object::new(ctx),
//         name,
//         description,
//         image_url,
//         creator: collection.creator,
//         mint_number: collection.minted,
//     };

//     // Lock NFT in kiosk using policy (ownership of policy consumed)
//     kiosk::lock(kiosk, cap, nft, policy);
// }

// // Complete an NFT transfer with royalty payment
// public fun confirm_transfer(
//     policy: &mut TransferPolicy<Nft>,
//     request: transfer_policy::TransferRequest<Nft>,
//     payment: Coin<SUI>,
//     royalty_wallet: address,
//     ctx: &mut tx_context::TxContext,
// ) {
//     // Calculate royalty (5% of payment value)
//     let payment_value = coin::value(&payment);
//     let royalty_amount = (payment_value * ROYALTY_BPS) / 10000; // Basis points to percentage
//     let royalty_coin = coin::split(&mut payment, royalty_amount, ctx);
//     transfer::public_transfer(royalty_coin, royalty_wallet);
//     // Return remaining payment to sender (or marketplace)
//     transfer::public_transfer(payment, tx_context::sender(ctx));
//     // Confirm the transfer request
//     transfer_policy::confirm_request(policy, request);
// }

// // Update the mint supply of a collection
// public fun update_mint_supply(
//     collection: &mut Collection,
//     new_supply: u64,
//     ctx: &mut tx_context::TxContext,
// ) {
//     assert!(collection.creator == tx_context::sender(ctx), ENotAuthorized);
//     assert!(collection.minted <= new_supply, EExceedsMintSupply);
//     collection.mint_supply = new_supply;
// }

// // Get the number of NFTs minted in a collection
// public fun get_minted_count(collection: &Collection): u64 {
//     collection.minted
// }
