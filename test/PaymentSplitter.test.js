const { expect } = require("chai");
const { ethers } = require("hardhat");
const { calculateFeeBN, splitBN } = require("./utils");

describe("PaymentSplitter", () => {
  let admin, bob, alice, payee1, payee2, payee3, payee4, payee5;
  let paymentSplitter;
  let mockToken;

  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
  const FEE = ethers.utils.parseEther("0.1");

  beforeEach(async () => {
    [admin, bob, alice, payee1, payee2, payee3, payee4, payee5] =
      await ethers.getSigners();
    const PaymentSplitter = await ethers.getContractFactory("PaymentSplitter");

    paymentSplitter = await PaymentSplitter.deploy();
    await paymentSplitter.deployed();

    const MockToken = await ethers.getContractFactory("MockToken");
    mockToken = await MockToken.deploy();
    await mockToken.deploy;

    expect(await paymentSplitter.admin()).to.equal(admin.address);
  });

  const ethBalance = async (addresses) => {
    return ([initPayee1Bal, initPayee2Bal, initPayee3Bal, initPayee4Bal] =
      await Promise.all(
        addresses.map(async (address) => {
          return admin.provider.getBalance(address);
        })
      ));
  };

  it("should share ETH", async () => {
    const sender = bob;
    const amount = ethers.utils.parseEther("0.5");
    const payees = [
      payee1.address,
      payee2.address,
      payee3.address,
      payee4.address,
    ];

    const initialBalances = await ethBalance(payees);

    await paymentSplitter
      .connect(sender)
      .sendPayment(payees, ZERO_ADDRESS, amount, { value: amount });

    const fee = calculateFeeBN(amount, FEE);
    const amountShared = amount.sub(fee);
    const splitAmount = splitBN(amountShared, payees.length);

    const finalBalances = await ethBalance(payees);

    for (let i = 0; i < payees.length; i++) {
      expect(finalBalances[i]).to.equal(initialBalances[i].add(splitAmount));
    }

    expect((await ethBalance([paymentSplitter.address]))[0]).to.equal(fee);
  });
});
