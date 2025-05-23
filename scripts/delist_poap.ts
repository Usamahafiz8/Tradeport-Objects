//this will remove and transfer the object to the signer's address

import { Transaction } from "@mysten/sui/transactions";
import { SuiClient, SuiObjectResponse } from "@mysten/sui/client";
import dotenv from "dotenv";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";

// Configure dotenv
dotenv.config();

// Configuration
const SUI_NETWORK: string = process.env.SUI_NETWORK || "https://fullnode.testnet.sui.io";
const client: SuiClient = new SuiClient({ url: SUI_NETWORK });

async function getSigner(): Promise<Ed25519Keypair> {
  const mnemonic: string | undefined = process.env.MNEMONIC;
  if (!mnemonic) {
    throw new Error("MNEMONIC not set in .env");
  }
  return Ed25519Keypair.deriveKeypair(mnemonic);
}

// Utility function to verify kioskOwnerCap
async function verifyKioskOwnerCap(kioskOwnerCapID: string, signerAddress: string): Promise<void> {
  const cap: SuiObjectResponse = await client.getObject({
    id: kioskOwnerCapID,
    options: { showOwner: true },
  });
  if (!cap.data) {
    throw new Error(`KioskOwnerCap ${kioskOwnerCapID} does not exist`);
  }
  const owner = cap.data.owner as { AddressOwner?: string };
  if (owner.AddressOwner !== signerAddress) {
    throw new Error(`KioskOwnerCap ${kioskOwnerCapID} is not owned by ${signerAddress}`);
  }
  console.log(`KioskOwnerCap ${kioskOwnerCapID} verified for ${signerAddress}`);
}

// Utility function to verify POAP in kiosk and fetch details
async function verifyPoapInKiosk(kioskID: string, poapID: string): Promise<void> {
  try {
    const kioskItems = await client.getDynamicFields({ parentId: kioskID });
    const poapExists = kioskItems.data.some((item) => item.objectId === poapID);
    if (!poapExists) {
      throw new Error(`POAP ${poapID} not found in kiosk ${kioskID}`);
    }
    const poap: SuiObjectResponse = await client.getObject({
      id: poapID,
      options: { showOwner: true },
    });
    if (!poap.data) {
      throw new Error(`POAP ${poapID} does not exist`);
    }
    const kioskObject = await client.getObject({
      id: kioskID,
      options: { showContent: true },
    });
    console.log(`POAP ${poapID} confirmed in kiosk ${kioskID} dynamic fields`);
    console.log("POAP owner:", JSON.stringify(poap.data.owner, null, 2));
    console.log("Kiosk items:", JSON.stringify(kioskItems.data, null, 2));
    console.log("POAP details:", JSON.stringify(poap.data, null, 2));
    console.log("Kiosk content:", JSON.stringify(kioskObject.data?.content, null, 2));
  } catch (error) {
    console.error("Error verifying POAP in kiosk:", error);
    throw error;
  }
}
async function delistPoapFromKiosk(): Promise<string> {
  const packageID: string = process.env.PACKAGE_ID || "";
  const signer: Ed25519Keypair = await getSigner();
  const signerAddress: string = await signer.toSuiAddress();
  const kioskID: string = "0x143c23b9248c591f5ebe76c28f3a4e2cacf6d1be012e45e517ac8b50fcf163ba";
  const kioskOwnerCapID: string = "0xbd3dce07800c24385598d7fce4cae0ff75b12095408fa2b4d081ac369d4a1cae";
  const poapID: string = "0x6b2f238a7264ea79614bd738d7c70c4a43a509cae4e3d3a3aa2088b622163ce0";
  const poapType: string = `${packageID}::nft::Public<${packageID}::nft::NFT1>`;
  const price: string = "1000000000"; // 1 SUI in MIST

  // Verify kioskOwnerCap
  await verifyKioskOwnerCap(kioskOwnerCapID, signerAddress);

  // Verify POAP is in kiosk
  await verifyPoapInKiosk(kioskID, poapID);

  // Create transaction to list, delist, and withdraw POAP
  const tx: Transaction = new Transaction();
  tx.setGasBudget(150000000); // Increased gas budget to account for additional operations

  // List the POAP
  tx.moveCall({
    target: "0x2::kiosk::list",
    arguments: [
      tx.object(kioskID),
      tx.object(kioskOwnerCapID),
      tx.pure.id(poapID),
      tx.pure.u64(price),
    ],
    typeArguments: [poapType],
  });

  // Delist the POAP
  tx.moveCall({
    target: "0x2::kiosk::delist",
    arguments: [
      tx.object(kioskID),
      tx.object(kioskOwnerCapID),
      tx.pure.id(poapID),
    ],
    typeArguments: [poapType],
  });

  // Withdraw the POAP from the kiosk and capture the returned object
  const poap = tx.moveCall({
    target: "0x2::kiosk::take",
    arguments: [
      tx.object(kioskID),
      tx.object(kioskOwnerCapID),
      tx.pure.id(poapID),
    ],
    typeArguments: [poapType],
  });

  // Transfer the withdrawn POAP to the signer's address
  tx.moveCall({
    target: "0x2::transfer::public_transfer",
    arguments: [
      poap,
      tx.pure.address(signerAddress),
    ],
    typeArguments: [poapType],
  });

  // Log transaction for debugging
  console.log("Transaction Block:", JSON.stringify(tx, null, 2));

  // Execute transaction
  const result = await client.signAndExecuteTransaction({
    transaction: tx,
    signer: signer,
    options: { showEffects: true, showObjectChanges: true },
  });

  // Check transaction status
  if (result.effects?.status.status !== "success") {
    console.error("Transaction effects:", JSON.stringify(result.effects, null, 2));
    throw new Error(`Transaction failed: ${JSON.stringify(result.effects?.status)}`);
  }

  console.log("POAP withdrawn successfully:", poapID);
  console.log("Transaction effects:", JSON.stringify(result.effects, null, 2));
  return poapID;
}

// Execute
delistPoapFromKiosk().then(console.log).catch(console.error);


// ///delisting happens but the item is still in kiosk section
// import { Transaction } from "@mysten/sui/transactions";
// import { SuiClient, SuiObjectResponse } from "@mysten/sui/client";
// import dotenv from "dotenv";
// import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";

// // Configure dotenv
// dotenv.config();

// // Configuration
// const SUI_NETWORK: string = process.env.SUI_NETWORK || "https://fullnode.testnet.sui.io";
// const client: SuiClient = new SuiClient({ url: SUI_NETWORK });

// // Utility function to derive signer from mnemonic
// async function getSigner(): Promise<Ed25519Keypair> {
//   const mnemonic: string | undefined = process.env.MNEMONIC;
//   if (!mnemonic) {
//     throw new Error("MNEMONIC not set in .env");
//   }
//   return Ed25519Keypair.deriveKeypair(mnemonic);
// }

// // Utility function to verify kioskOwnerCap
// async function verifyKioskOwnerCap(kioskOwnerCapID: string, signerAddress: string): Promise<void> {
//   const cap: SuiObjectResponse = await client.getObject({
//     id: kioskOwnerCapID,
//     options: { showOwner: true },
//   });
//   if (!cap.data) {
//     throw new Error(`KioskOwnerCap ${kioskOwnerCapID} does not exist`);
//   }
//   const owner = cap.data.owner as { AddressOwner?: string };
//   if (owner.AddressOwner !== signerAddress) {
//     throw new Error(`KioskOwnerCap ${kioskOwnerCapID} is not owned by ${signerAddress}`);
//   }
//   console.log(`KioskOwnerCap ${kioskOwnerCapID} verified for ${signerAddress}`);
// }

// // Utility function to verify POAP in kiosk and fetch details
// async function verifyPoapInKiosk(kioskID: string, poapID: string): Promise<void> {
//   try {
//     const kioskItems = await client.getDynamicFields({ parentId: kioskID });
//     const poapExists = kioskItems.data.some((item) => item.objectId === poapID);
//     if (!poapExists) {
//       throw new Error(`POAP ${poapID} not found in kiosk ${kioskID}`);
//     }
//     const poap: SuiObjectResponse = await client.getObject({
//       id: poapID,
//       options: { showOwner: true },
//     });
//     if (!poap.data) {
//       throw new Error(`POAP ${poapID} does not exist`);
//     }
//     const kioskObject = await client.getObject({
//       id: kioskID,
//       options: { showContent: true },
//     });
//     console.log(`POAP ${poapID} confirmed in kiosk ${kioskID} dynamic fields`);
//     console.log("POAP owner:", JSON.stringify(poap.data.owner, null, 2));
//     console.log("Kiosk items:", JSON.stringify(kioskItems.data, null, 2));
//     console.log("POAP details:", JSON.stringify(poap.data, null, 2));
//     console.log("Kiosk content:", JSON.stringify(kioskObject.data?.content, null, 2));
//   } catch (error) {
//     console.error("Error verifying POAP in kiosk:", error);
//     throw error;
//   }
// }

// // Main function to list and delist POAP from kiosk
// async function delistPoapFromKiosk(): Promise<string> {
//   const packageID: string = process.env.PACKAGE_ID || "0x8e89dc6c086afb140ea3e7d3b0236b8c5b7942252a5376e0a1c7fcb699d65c1b";
//   const signer: Ed25519Keypair = await getSigner();
//   const signerAddress: string = await signer.toSuiAddress();
//   const kioskID: string = "0xdeeb1e0d17de22ebf09e5d258844c1eff16ae5d483c3fbd51e9249433a7bf660";
//   const kioskOwnerCapID: string = "0x76b0888985d3f0b16731c39d818620f5745e4ba9252a447ecf92a019f6bf44ca";
//   const poapID: string = "0xfc129571bf0f1185b0fed4079c5ce6bf0bc70ab6b0e4fa8296c78db2302bc9c4";
//   const poapType: string = `${packageID}::nft::Public<${packageID}::nft::NFT1>`;
//   const price: string = "1000000000"; // 1 SUI in MIST

//   // Verify kioskOwnerCap
//   await verifyKioskOwnerCap(kioskOwnerCapID, signerAddress);

//   // Verify POAP is in kiosk
//   await verifyPoapInKiosk(kioskID, poapID);

//   // Create transaction to list and delist POAP
//   const tx: Transaction = new Transaction();
//   tx.setGasBudget(100000000);

//   // List the POAP
//   tx.moveCall({
//     target: "0x2::kiosk::list",
//     arguments: [
//       tx.object(kioskID),
//       tx.object(kioskOwnerCapID),
//       tx.pure.id(poapID),
//       tx.pure.u64(price),
//     ],
//     typeArguments: [poapType],
//   });

//   // Delist the POAP
//   tx.moveCall({
//     target: "0x2::kiosk::delist",
//     arguments: [
//       tx.object(kioskID),
//       tx.object(kioskOwnerCapID),
//       tx.pure.id(poapID),
//     ],
//     typeArguments: [poapType],
//   });

//   // Log transaction for debugging
//   console.log("Transaction Block:", JSON.stringify(tx, null, 2));

//   // Execute transaction
//   const result = await client.signAndExecuteTransaction({
//     transaction: tx,
//     signer: signer,
//     options: { showEffects: true, showObjectChanges: true },
//   });

//   // Check transaction status
//   // @ts-ignore
//   if (result.effects?.status.status !== "success") {
//     console.error("Transaction effects:", JSON.stringify(result.effects, null, 2));
//     throw new Error(`Transaction failed: ${JSON.stringify(result.effects?.status)}`);
//   }

//   console.log("POAP delisted successfully:", poapID);
//   console.log("Transaction effects:", JSON.stringify(result.effects, null, 2));
//   return poapID;
// }

// // Execute
// delistPoapFromKiosk().then(console.log).catch(console.error);