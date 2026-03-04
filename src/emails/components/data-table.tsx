import { Text } from '@react-email/components';
import { colors, typography, borders, spacing } from '../styles';

type DataTableProps = {
    title: string;
    columns: string[];
    rows: string[][];
};

export function DataTable({ title, columns, rows }: DataTableProps) {
    return (
        <div>
            {title && (
                <Text style={{
                    fontFamily: typography.fontStack,
                    fontSize: typography.sizes.body,
                    fontWeight: typography.weights.medium,
                    color: colors.textPrimary,
                    margin: `0 0 ${spacing.sm} 0`,
                }}>
                    {title}
                </Text>
            )}
            <table
                role="presentation"
                width="100%"
                cellPadding="0"
                cellSpacing="0"
                style={{ borderCollapse: 'collapse' }}
            >
                <thead>
                    <tr style={{ backgroundColor: colors.bg }}>
                        {columns.map((col, i) => (
                            <th
                                key={i}
                                style={{
                                    fontFamily: typography.fontStack,
                                    fontSize: typography.sizes.label,
                                    fontWeight: typography.weights.medium,
                                    color: colors.textMuted,
                                    letterSpacing: typography.letterSpacing.label,
                                    textTransform: 'uppercase',
                                    textAlign: i === 0 ? 'left' : 'right',
                                    padding: '10px 12px',
                                    borderBottom: borders.tableRow,
                                }}
                            >
                                {col}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, ri) => (
                        <tr key={ri}>
                            {row.map((cell, ci) => (
                                <td
                                    key={ci}
                                    style={{
                                        fontFamily: typography.fontStack,
                                        fontSize: '14px',
                                        fontWeight: typography.weights.regular,
                                        color: colors.textPrimary,
                                        textAlign: ci === 0 ? 'left' : 'right',
                                        padding: '10px 12px',
                                        borderBottom: borders.tableRow,
                                    }}
                                >
                                    {cell}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
