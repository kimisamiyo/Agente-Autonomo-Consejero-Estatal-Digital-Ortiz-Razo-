const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Balance TSYS:", hre.ethers.formatEther(balance));

  const CeditRegistros = await hre.ethers.getContractFactory("CeditRegistros");
  const contract = await CeditRegistros.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("CeditRegistros deployed to:", address);

  const envPath = path.join(__dirname, "..", "..", ".env");
  if (fs.existsSync(envPath)) {
    let env = fs.readFileSync(envPath, "utf8");
    if (/CEDIT_CONTRACT_ADDRESS=/.test(env)) {
      env = env.replace(/CEDIT_CONTRACT_ADDRESS=.*/m, `CEDIT_CONTRACT_ADDRESS=${address}`);
    } else {
      env += `\nCEDIT_CONTRACT_ADDRESS=${address}\n`;
    }
    fs.writeFileSync(envPath, env);
    console.log("Updated", envPath);
  }

  const outPath = path.join(__dirname, "..", "deployment-zktanenbaum.json");
  fs.writeFileSync(
    outPath,
    JSON.stringify({ network: "zktanenbaum", address, deployer: deployer.address }, null, 2)
  );
  console.log("Wrote", outPath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
