const { BigNumber } = require("ethers");

let decimals = ethers.BigNumber.from(18);
decimals = ethers.BigNumber.from(10).pow(decimals);

const calculateFeeBN = (amountBN, feeBN) => {
  const numerator = BigNumber.from(100).mul(decimals);
  return amountBN.mul(feeBN).div(numerator);
};

const splitBN = (amountBN, numPayees) => {
  return amountBN.div(BigNumber.from(numPayees));
};
module.exports = {
  calculateFeeBN,
  splitBN,
};
