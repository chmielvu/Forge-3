
import React from 'react';
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Tooltip } from 'recharts';
import { YandereLedger } from '../types';

interface Props {
  ledger?: YandereLedger;
}

const StatusLedger: React.FC<Props> = ({ ledger }) => {
  if (!ledger) return null;

  const data = [
    { subject: 'Integrity', A: ledger.physicalIntegrity || 0, fullMark: 100 },
    { subject: 'Trauma', A: ledger.traumaLevel || 0, fullMark: 100 },
    { subject: 'Shame', A: ledger.shamePainAbyssLevel || 0, fullMark: 100 },
    { subject: 'Compliance', A: ledger.complianceScore || 0, fullMark: 100 },
    { subject: 'Fear', A: ledger.fearOfAuthority || 0, fullMark: 100 },
    { subject: 'Validation', A: ledger.desireForValidation || 0, fullMark: 100 },
    { subject: 'Manipulation', A: ledger.capacityForManipulation || 0, fullMark: 100 },
    { subject: 'Hope', A: ledger.hopeLevel || 0, fullMark: 100 },
  ];

  return (
    <ResponsiveContainer width="100%" height={200}>
      <RadarChart cx="50%" cy="50%" outerRadius="80%" data={data} className="font-mono text-xs">
        <PolarGrid stroke="#292524" />
        <PolarAngleAxis dataKey="subject" tick={{ fill: '#78716c' }} />
        <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: '#78716c', fontSize: '8px' }} />
        <Radar name="Subject 84" dataKey="A" stroke="#facc15" fill="#facc15" fillOpacity={0.4} />
        <Tooltip
          contentStyle={{
            backgroundColor: 'rgba(5,5,5,0.9)',
            borderColor: '#facc15',
            color: '#facc15',
            fontSize: '10px',
            fontFamily: 'monospace',
            textTransform: 'uppercase',
            padding: '8px',
          }}
          itemStyle={{ color: '#e7e5e4' }}
          labelStyle={{ color: '#facc15', marginBottom: '4px' }}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
};

export default StatusLedger;
