const { expect } = require("chai");
const { ethers } = require("hardhat");
const { calculateFeeBN, splitBN } = require("./utils");

describe("PaymentSplitter", () => {
  let admin, bob, alice, payee1, payee2, payee3, payee4, payee5;
  let paymentSplitter;
  let mockToken;
  let payees;

  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
  const FEE = ethers.utils.parseEther("0.1");

  beforeEach(async () => {
    [admin, bob, alice, payee1, payee2, payee3, payee4, payee5] =
      await ethers.getSigners();

    payees = [
      payee1.address,
      payee2.address,
      payee3.address,
      payee4.address,
      payee5.address,
    ];

    const PaymentSplitter = await ethers.getContractFactory("PaymentSplitter");

    paymentSplitter = await PaymentSplitter.deploy();
    await paymentSplitter.deployed();

    const MockToken = await ethers.getContractFactory("MockToken");
    mockToken = await MockToken.deploy();
    await mockToken.deploy;

    expect(await paymentSplitter.admin()).to.equal(admin.address);
  });

  const ethBalance = async (addresses) => {
    return (balances = await Promise.all(
      addresses.map(async (address) => {
        return admin.provider.getBalance(address);
      })
    ));
  };

  const tokenBalance = async (addresses) => {
    return (balances = await Promise.all(
      addresses.map(async (address) => {
        return mockToken.balanceOf(address);
      })
    ));
  };

  it("should share ETH", async () => {
    const sender = bob;
    const amount = ethers.utils.parseEther("0.5");

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

  it("should send token", async () => {
    const sender = alice;
    const amount = ethers.utils.parseEther("250");

    await mockToken.transfer(sender.address, amount);
    await mockToken.connect(sender).approve(paymentSplitter.address, amount);

    const initialBalances = await tokenBalance(payees);

    //expect(await tokenBalance([sender.address])).to.equal(amount);

    await paymentSplitter
      .connect(sender)
      .sendPayment(payees, mockToken.address, amount);

    const fee = calculateFeeBN(amount, FEE);
    const amountShared = amount.sub(fee);
    const splitAmount = splitBN(amountShared, payees.length);

    const finalBalances = await tokenBalance(payees);

    for (let i = 0; i < payees.length; i++) {
      expect(finalBalances[i]).to.equal(initialBalances[i].add(splitAmount));
    }

    expect((await tokenBalance([paymentSplitter.address]))[0]).to.equal(fee);
  });
});
