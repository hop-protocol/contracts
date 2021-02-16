// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "./Bridge.sol";

import "../interfaces/IMessengerWrapper.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

contract L1_BridgeConfig is Ownable {
    using SafeMath for uint256;

    /* ========== State ========== */

    mapping(uint256 => IMessengerWrapper) private _crossDomainMessengerWrapper;
    uint256 private _challengeAmountMultiplier = 1;
    uint256 private _challengeAmountDivisor = 10;
    uint256 private _timeSlotSize = 3 hours;
    uint256 private _challengePeriod = 1 days;
    uint256 private _challengeResolutionPeriod = 8 days;
    uint256 private _unstakePeriod = 9 days; 

    /* ========== External Management Setters ========== */

    function setCrossDomainMessengerWrapper(uint256 chainId, IMessengerWrapper crossDomainMessengerWrapper) external onlyOwner {
        _crossDomainMessengerWrapper[chainId] = crossDomainMessengerWrapper;
    }

    function setChallengeAmountDivisor(uint256 challengeAmountDivisor) external onlyOwner {
        _challengeAmountDivisor = challengeAmountDivisor;
    }

    function setTimeSlotSize(uint256 timeSlotSize) external onlyOwner {
        _timeSlotSize = timeSlotSize;
    }

    function setChallengePeriod(uint256 challengePeriod) external onlyOwner {
        _challengePeriod = challengePeriod;
    }

    function setChallengeAmountMultiplier(uint256 challengeAmountMultiplier) external onlyOwner {
        _challengeAmountMultiplier = challengeAmountMultiplier;
    }

    function setChallengeResolutionPeriod(uint256 challengeResolutionPeriod) external onlyOwner {
        _challengeResolutionPeriod = challengeResolutionPeriod;
    }

    function setUnstakePeriod(uint256 unstakePeriod) external onlyOwner {
        _unstakePeriod = unstakePeriod;
    }

    /* ========== Public Getters ========== */

    function getCrossDomainMessengerWrapper(uint256 chainId) public view returns(IMessengerWrapper) {
        return _crossDomainMessengerWrapper[chainId];
    }

    function getChallengeAmountDivisor() public view returns(uint256) {
        return _challengeAmountDivisor;
    }

    function getTimeSlotSize() public view returns(uint256) {
        return _timeSlotSize;
    }

    function getChallengePeriod() public view returns(uint256) {
        return _challengePeriod;
    }

    function getChallengeAmountMultiplier() public view returns(uint256) {
        return _challengeAmountMultiplier;
    }

    function getChallengeResolutionPeriod() public view returns(uint256) {
        return _challengeResolutionPeriod;
    }

    function getUnstakePeriod() public view returns(uint256) {
        return _unstakePeriod;
    }

    function getBondForTransferAmount(uint256 amount) public view returns (uint256) {
        // Bond covers amount plus a bounty to pay a potential challenger
        return amount.add(getChallengeAmountForTransferAmount(amount));
    }

    function getChallengeAmountForTransferAmount(uint256 amount) public view returns (uint256) {
        // Bond covers amount plus a bounty to pay a potential challenger
        return amount.mul(_challengeAmountMultiplier).div(_challengeAmountDivisor);
    }

    function getTimeSlot(uint256 _time) public view returns (uint256) {
        return _time / _timeSlotSize;
    }

    function getNumberOfChallengeableTimeSlots() public view returns (uint256) {
        return _timeSlotSize / _challengePeriod;
    }
}
