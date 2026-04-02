import { Text } from '@react-email/components';
import { colors, typography, borders, spacing } from '../styles';

type DataTableProps = {
    title?: string;
    columns: string[];
    rows: string[][];
    /** Per-column alignment. Defaults to left for col 0, right for all others. */
    align?: Array<'left' | 'right'>;
};

export function DataTable({ title, columns, rows, align }: DataTableProps) {
    const colAlign = (i: number): 'left' | 'right' =>
        align ? (align[i] ?? 'right') : (i === 0 ? 'left' : 'right');
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
                                    textAlign: colAlign(i),
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
                                        textAlign: colAlign(ci),
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
