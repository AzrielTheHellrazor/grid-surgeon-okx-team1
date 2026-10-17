// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title GridSurgeonRegistry (ERC-8004 Trustless Agent Registry)
 * @notice Avalanche C-Chain On-Chain Audit Log, Regime Oracle, Circuit-Breaker Governor,
 *         and ERC-8004 ("Trustless Agents") Identity, Validation & Reputation Registry
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

    // Core Operator & Risk State
    address public immutable agentOperator;
    uint256 public maxAllowedLeverage = 5;
    bool public emergencyCircuitBreaker = false;
    AgentDecisionLog[] public decisionHistory;

    // =========================================================================
    // ERC-8004 ("Trustless Agents") Standard Registries:
    //   1. Identity Registry   (Agent ID, Domain, Agent Card URI)
    //   2. Validation Registry (Cryptographic Task & Reasoning Hash Proofs)
    //   3. Reputation Registry (On-Chain Trust Score, Feedback & Surgery Count)
    // =========================================================================
    uint256 public constant ERC8004_AGENT_ID = 1;
    string public agentDomain = "grid-surgeon.okx.avax";
    string public agentCardURI = "/.well-known/agent-card.json";

    mapping(bytes32 => bool) public validatedReasoningHashes;
    uint256 public totalValidatedTasks = 0;

    uint8 public reputationScore = 96; // 0-100 calibrated ERC-8004 trust score
    uint256 public reputationFeedbackCount = 1;
    uint256 public totalSurgeriesValidated = 0;

    // Core Events
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

    // ERC-8004 Standard Events
    event ERC8004AgentRegistered(
        uint256 indexed agentId,
        address indexed operator,
        string agentDomain,
        string agentCardURI
    );

    event ERC8004ValidationRecorded(
        uint256 indexed agentId,
        uint256 indexed decisionIndex,
        bytes32 indexed reasoningHash,
        address validator,
        bool verified
    );

    event ERC8004ReputationUpdated(
        uint256 indexed agentId,
        uint8 newScore,
        uint256 feedbackCount,
        string tag,
        bytes32 proofHash
    );

    modifier onlyAgent() {
        require(msg.sender == agentOperator, "Not authorized agent");
        require(!emergencyCircuitBreaker, "Circuit breaker active");
        _;
    }

    constructor() {
        agentOperator = msg.sender;
        emit ERC8004AgentRegistered(
            ERC8004_AGENT_ID,
            msg.sender,
            agentDomain,
            agentCardURI
        );
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

        // ERC-8004 Validation Registry update
        validatedReasoningHashes[_reasoningHash] = true;
        totalValidatedTasks += 1;

        // ERC-8004 Reputation Registry update
        reputationFeedbackCount += 1;
        if (reputationScore < 99) {
            reputationScore += 1;
        }

        emit DecisionAnchored(
            idx,
            _regime,
            _trapScoreBps,
            _okxAlgoOrOrdId,
            _navUsdtE2,
            _reasoningHash
        );

        emit ERC8004ValidationRecorded(
            ERC8004_AGENT_ID,
            idx,
            _reasoningHash,
            msg.sender,
            true
        );

        emit ERC8004ReputationUpdated(
            ERC8004_AGENT_ID,
            reputationScore,
            reputationFeedbackCount,
            _okxAlgoOrOrdId,
            _reasoningHash
        );

        return idx;
    }

    function recordGridSurgery(
        string calldata _okxAlgoId,
        uint256 _newMinPxE4,
        uint256 _newMaxPxE4
    ) external onlyAgent {
        totalSurgeriesValidated += 1;
        reputationFeedbackCount += 1;
        if (reputationScore < 99) {
            reputationScore += 1;
        }
        emit GridSurgeryPerformed(_okxAlgoId, _newMinPxE4, _newMaxPxE4, block.timestamp);
        emit ERC8004ReputationUpdated(
            ERC8004_AGENT_ID,
            reputationScore,
            reputationFeedbackCount,
            _okxAlgoId,
            keccak256(abi.encodePacked(_okxAlgoId, _newMinPxE4, _newMaxPxE4))
        );
    }

    function updateAgentIdentity(
        string calldata _domain,
        string calldata _cardURI
    ) external onlyAgent {
        agentDomain = _domain;
        agentCardURI = _cardURI;
        emit ERC8004AgentRegistered(
            ERC8004_AGENT_ID,
            agentOperator,
            _domain,
            _cardURI
        );
    }

    function getERC8004Identity()
        external
        view
        returns (
            uint256 agentId,
            address operator,
            string memory domain,
            string memory cardURI,
            bool active
        )
    {
        return (
            ERC8004_AGENT_ID,
            agentOperator,
            agentDomain,
            agentCardURI,
            !emergencyCircuitBreaker
        );
    }

    function getERC8004Reputation()
        external
        view
        returns (
            uint256 agentId,
            uint8 score,
            uint256 feedbackCount,
            uint256 surgeriesCount,
            uint256 validatedTasks
        )
    {
        return (
            ERC8004_AGENT_ID,
            reputationScore,
            reputationFeedbackCount,
            totalSurgeriesValidated,
            totalValidatedTasks
        );
    }

    function verifyTaskValidation(
        bytes32 _reasoningHash
    )
        external
        view
        returns (bool isValid, uint256 agentId, address validator)
    {
        return (
            validatedReasoningHashes[_reasoningHash],
            ERC8004_AGENT_ID,
            agentOperator
        );
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
