import { loadFixture } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import { expect } from "chai";
import hre from "hardhat";
import { getAddress, parseGwei } from "viem";

describe("AutoWallet", function () {
  const FEE_PERCENT = 1000; // 10%
  async function deployAutoWalletFixture() {
    const [owner, receiver, depositor] = await hre.viem.getWalletClients();

    const autoWallet = await hre.viem.deployContract("AutoWallet", [
      receiver.account.address,
      FEE_PERCENT,
    ]);

    const publicClient = await hre.viem.getPublicClient();

    return {
      autoWallet,
      owner,
      receiver,
      depositor,
      publicClient,
    };
  }

  describe("Deployment", function () {
    it("Should set the right receiver and fee", async function () {
      const { autoWallet, receiver } = await loadFixture(
        deployAutoWalletFixture
      );

      expect(await autoWallet.read.receiver()).to.equal(
        getAddress(receiver.account.address)
      );

      expect(await autoWallet.read.feePercent()).to.equal(FEE_PERCENT);
    });
  });

  describe("Deposit", function () {
    it("Should deposit correctly", async function () {
      const { autoWallet, depositor, receiver, publicClient } =
        await loadFixture(deployAutoWalletFixture);

      const amount = parseGwei("1");

      const receiver_balance_before = await publicClient.getBalance({
        address: receiver.account.address,
      });

      await depositor.sendTransaction({
        to: autoWallet.address,
        value: amount,
      });

      const fee = (amount * BigInt(FEE_PERCENT)) / 10000n;

      expect(await autoWallet.read.getBalance()).to.equal(fee);

      const amount_minus_fee = amount - fee;

      expect(
        await publicClient.getBalance({
          address: receiver.account.address,
        })
      ).to.equal(receiver_balance_before + amount_minus_fee);
    });
  });

  describe("Withdraw", function () {
    it("Should withdraw correctly", async function () {
      const { autoWallet, owner, depositor, receiver, publicClient } =
        await loadFixture(deployAutoWalletFixture);

      const amount = parseGwei("1");

      await depositor.sendTransaction({
        to: autoWallet.address,
        value: amount,
      });

      const fee = (amount * BigInt(FEE_PERCENT)) / 10000n;

      const amount_minus_fee = amount - fee;

      const owner_balance_before = await publicClient.getBalance({
        address: owner.account.address,
      });

      const withdraw_amount = await autoWallet.read.getBalance();

      await autoWallet.write.withdraw([withdraw_amount, owner.account.address]);

      expect(await autoWallet.read.getBalance()).to.equal(0);

      expect(
        await publicClient.getBalance({
          address: owner.account.address,
        })
      ).to.equal(owner_balance_before + amount_minus_fee);
    });
  });
});