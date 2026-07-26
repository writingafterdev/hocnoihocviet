'use client';

import type { CoherenceFlow } from '@/types/writing';

function shortNodeLabel(nodeId: string) {
  const match = nodeId.match(/^sentence-\d+-(\d+)$/);
  return match ? `S${match[1]}` : nodeId;
}

export default function CoherenceFlowDiagram({
  nodeIds,
  flows,
  selectedFlowId,
  solution = false,
  compact = false,
}: {
  nodeIds: string[];
  flows: CoherenceFlow[];
  selectedFlowId?: string;
  solution?: boolean;
  compact?: boolean;
}) {
  const canvasWidth = compact ? 360 : 720;
  const chipWidth = compact ? 38 : 48;
  const chipHeight = compact ? 28 : 32;
  const chipTop = 6;
  const chipBottom = chipTop + chipHeight;
  const laneStart = compact ? 54 : 72;
  const laneGap = compact ? 20 : 27;
  const canvasHeight = Math.max(compact ? 92 : 124, laneStart + flows.length * laneGap + 14);
  const positionById = new Map(nodeIds.map((nodeId, index) => [nodeId, index]));
  const activeNodes = new Set(flows.flatMap(flow => [...flow.fromNodeIds, flow.toNodeId]));
  const nodeX = (nodeId: string) => {
    const index = positionById.get(nodeId) ?? 0;
    return ((index + 0.5) / Math.max(nodeIds.length, 1)) * canvasWidth;
  };
  const laneByFlowId = new Map(
    [...flows]
      .sort((left, right) => {
        const leftPositions = [...left.fromNodeIds, left.toNodeId].map(nodeX);
        const rightPositions = [...right.fromNodeIds, right.toNodeId].map(nodeX);
        return Math.max(...leftPositions) - Math.min(...leftPositions) - (Math.max(...rightPositions) - Math.min(...rightPositions));
      })
      .map((flow, index) => [flow.edgeId, index]),
  );

  return (
    <svg
      aria-label="Sơ đồ mạch ý"
      className="block w-full overflow-visible"
      viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
      preserveAspectRatio="xMidYMin meet"
    >
      <defs>
        <marker id={`flow-arrow-active-${compact ? 'compact' : 'full'}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 2 2 L 8 5 L 2 8" fill="none" stroke="#3478F6" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </marker>
        <marker id={`flow-arrow-context-${compact ? 'compact' : 'full'}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 2 2 L 8 5 L 2 8" fill="none" stroke="#64748B" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </marker>
      </defs>

      {flows.map((flow, index) => {
        const isActive = solution || flow.edgeId === selectedFlowId || flow.status !== 'works';
        const stroke = isActive ? '#3478F6' : '#64748B';
        const marker = `url(#flow-arrow-${isActive ? 'active' : 'context'}-${compact ? 'compact' : 'full'})`;
        const laneY = laneStart + (laneByFlowId.get(flow.edgeId) ?? index) * laneGap;
        const portOffset = (index - (flows.length - 1) / 2) * (compact ? 5 : 8);
        const sourceXs = flow.fromNodeIds.map(nodeId => nodeX(nodeId) + portOffset);
        const targetX = nodeX(flow.toNodeId) + portOffset;
        const sharedX = sourceXs.reduce((sum, x) => sum + x, 0) / Math.max(sourceXs.length, 1);
        const strokeWidth = isActive ? (compact ? 1.55 : 1.8) : (compact ? 1.2 : 1.35);

        if (sourceXs.length > 1) {
          return (
            <g key={flow.edgeId} fill="none" stroke={stroke} strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth}>
              {sourceXs.map((sourceX, sourceIndex) => (
                <path key={`${flow.edgeId}-${sourceIndex}`} d={`M${sourceX},${chipBottom} L${sourceX},${laneY} L${sharedX},${laneY}`} />
              ))}
              <path d={`M${sharedX},${laneY} L${targetX},${laneY} L${targetX},${chipBottom}`} markerEnd={marker} />
            </g>
          );
        }

        return (
          <path
            key={flow.edgeId}
            d={`M${sourceXs[0]},${chipBottom} L${sourceXs[0]},${laneY} L${targetX},${laneY} L${targetX},${chipBottom}`}
            fill="none"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            markerEnd={marker}
          />
        );
      })}

      {nodeIds.map(nodeId => {
        const isActive = solution || activeNodes.has(nodeId);
        const muted = !solution && activeNodes.size > 0 && !activeNodes.has(nodeId);
        return (
          <g key={nodeId} transform={`translate(${nodeX(nodeId) - chipWidth / 2} ${chipTop})`}>
            <rect
              width={chipWidth}
              height={chipHeight}
              rx={compact ? 6 : 8}
              fill={isActive ? '#EAF4FF' : muted ? 'rgba(255,255,255,0.55)' : '#FFFFFF'}
              stroke={isActive ? 'rgba(52,120,246,0.45)' : muted ? 'rgba(0,0,0,0.04)' : 'rgba(100,116,139,0.35)'}
              strokeWidth="1"
            />
            <text
              x={chipWidth / 2}
              y={chipHeight / 2 + 0.5}
              textAnchor="middle"
              dominantBaseline="middle"
              fill={isActive ? '#1E5BC8' : muted ? 'rgba(0,0,0,0.28)' : '#475569'}
              fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
              fontSize={compact ? 9 : 11}
              fontWeight="700"
              letterSpacing={compact ? '0.5px' : '0.7px'}
            >
              {shortNodeLabel(nodeId)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
