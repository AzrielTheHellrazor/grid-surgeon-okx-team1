// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title GridSurgeonRegistry
 * @notice Avalanche C-Chain On-Chain Audit Log, Regime Oracle, and Circuit-Breaker Governor
 *         for the Grid-Surgeon autonomous OKX ATK agent.
 */
contract GridSurgeonRegistry {
    enum MarketRegime {
        RANGING_GRID,
        BULL_TRAP_SHORT,
        BEAR_TRAP_LONG,
        BREAKOUT_DCA,
        MACRO_BUNKER
    }

    struct AgentDecisionLog {
        uint256 timestamp;
        MarketRegime regime;
        int256 trapDivergenceScoreBps; // e.g., +1250 = +1.25 trap score
        uint256 avaxPriceE4;           // AVAX price * 1e4
        uint256 navUsdtE2;             // Total OKX portfolio NAV in cents
        uint256 lockedEarnUsdtE2;      // Cumulative profit swept to OKX Simple Earn
        string okxAlgoOrOrdId;         // Exact OKX algoId / ordId for cross-verification
        bytes32 reasoningHash;         // keccak256 hash of full JSON telemetry + LLM reasoning
    }

    address public immutable agentOperator;
    uint256 public maxAllowedLeverage = 5;
    bool public emergencyCircuitBreaker = false;
    AgentDecisionLog[] public decisionHistory;

    event DecisionAnchored(
        uint256 indexed index,
        MarketRegime regime,
        int256 trapDivergenceScoreBps,
        string okxAlgoOrOrdId,
        uint256 navUsdtE2,
        bytes32 reasoningHash
    );

    event GridSurgeryPerformed(
        string indexed okxAlgoId,
        uint256 newMinPxE4,
        uint256 newMaxPxE4,
        uint256 timestamp
    );

    event CircuitBreakerToggled(bool active, uint256 timestamp);

    modifier onlyAgent() {
        require(msg.sender == agentOperator, "Not authorized agent");
        require(!emergencyCircuitBreaker, "Circuit breaker active");
        _;
    }

    constructor() {
        agentOperator = msg.sender;
    }

    function recordDecision(
        MarketRegime _regime,
        int256 _trapScoreBps,
        uint256 _avaxPriceE4,
        uint256 _navUsdtE2,
        uint256 _lockedEarnUsdtE2,
        string calldata _okxAlgoOrOrdId,
        bytes32 _reasoningHash
    ) external onlyAgent returns (uint256) {
        decisionHistory.push(
            AgentDecisionLog({
                timestamp: block.timestamp,
                regime: _regime,
                trapDivergenceScoreBps: _trapScoreBps,
                avaxPriceE4: _avaxPriceE4,
                navUsdtE2: _navUsdtE2,
                lockedEarnUsdtE2: _lockedEarnUsdtE2,
                okxAlgoOrOrdId: _okxAlgoOrOrdId,
                reasoningHash: _reasoningHash
            })
        );
        uint256 idx = decisionHistory.length - 1;
        emit DecisionAnchored(
            idx,
            _regime,
            _trapScoreBps,
            _okxAlgoOrOrdId,
            _navUsdtE2,
            _reasoningHash
        );
        return idx;
    }

    function recordGridSurgery(
        string calldata _okxAlgoId,
        uint256 _newMinPxE4,
        uint256 _newMaxPxE4
    ) external onlyAgent {
        emit GridSurgeryPerformed(_okxAlgoId, _newMinPxE4, _newMaxPxE4, block.timestamp);
    }

    function setCircuitBreaker(bool _active) external {
        require(msg.sender == agentOperator, "Not authorized");
        emergencyCircuitBreaker = _active;
        emit CircuitBreakerToggled(_active, block.timestamp);
    }

    function totalDecisions() external view returns (uint256) {
        return decisionHistory.length;
    }
}
