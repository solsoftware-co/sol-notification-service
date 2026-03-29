import { Text } from '@react-email/components';
import { colors, typography, spacing, borders, radii } from '../styles';
import { LabelText } from './label-text';

export type StatMetric = {
    value: string;
    label: string;       // friendly label shown top-left, e.g. "Website Visits"
    sublabel: string;    // descriptor shown under the number, e.g. "Sessions"
    // Optional historical context — card falls back to simple display if absent
    changePhrase?: string;      // e.g. "10% more sessions" (the bolded highlight)
    changeDirection?: 'up' | 'down' | 'neutral';
    periodLabel?: string;       // e.g. "Feb 23 – Mar 1"
    comparisonLabel?: string;   // e.g. "the previous 3 weeks"
    bars?: Array<{ label: string; value: number; isCurrent: boolean }>;
};

type StatCardProps = {
    metric: StatMetric;
};

const CHART_HEIGHT = 56;
const BAR_MIN_HEIGHT = 4;

export function StatCard({ metric }: StatCardProps) {
    const hasHistory = metric.bars && metric.bars.length > 0;
    const maxBarVal = hasHistory ? Math.max(...metric.bars!.map(b => b.value)) : 1;

    const isNeutral = metric.changeDirection === 'neutral';

    return (
        <div style={{
            backgroundColor: colors.shading,
            border: borders.card,
            borderRadius: radii.card,
            padding: spacing.lg,
            marginBottom: spacing.md,
        }}>
            <table role="presentation" width="100%" cellPadding="0" cellSpacing="0">
                <tr>
                    {/* Left column: label + description */}
                    <td style={{ verticalAlign: 'middle', paddingRight: '40px', width: '55%' }}>
                        <LabelText style={{ margin: '0 0 12px 0' }}>
                            {metric.label}
                            {hasHistory && metric.changeDirection && (
                                <span style={{
                                    marginLeft: '5px',
                                    color: metric.changeDirection === 'up'   ? colors.positive
                                         : metric.changeDirection === 'down' ? colors.negative
                                         : colors.textMuted,
                                    fontWeight: typography.weights.regular,
                                    letterSpacing: 'normal',
                                    textTransform: 'none',
                                }}>
                                    {metric.changeDirection === 'up' ? '↑' : metric.changeDirection === 'down' ? '↓' : '→'}
                                </span>
                            )}
                        </LabelText>
                        {hasHistory && metric.periodLabel && metric.comparisonLabel && (
                            <Text style={{
                                fontFamily: typography.fontStack,
                                fontSize: typography.sizes.small,
                                fontWeight: typography.weights.regular,
                                color: colors.textSecondary,
                                lineHeight: typography.lineHeights.body,
                                margin: '0',
                            }}>
                                {isNeutral ? (
                                    <>Your {metric.label.toLowerCase()} was consistent for <strong>{metric.periodLabel}</strong>, compared to {metric.comparisonLabel}.</>
                                ) : (
                                    <>You had <strong>{metric.changePhrase}</strong> for <strong>{metric.periodLabel}</strong>, compared to {metric.comparisonLabel}.</>
                                )}
                            </Text>
                        )}
                    </td>

                    {/* Right column: big number + mini bar chart */}
                    <td style={{ verticalAlign: 'top', textAlign: 'right', width: '25%' }}>
                        <Text style={{
                            fontFamily: typography.fontStack,
                            fontSize: typography.sizes.display,
                            fontWeight: typography.weights.regular,
                            color: colors.textPrimary,
                            lineHeight: typography.lineHeights.tight,
                            letterSpacing: typography.letterSpacing.tight,
                            margin: '0 0 4px 0',
                            textAlign: 'right',
                        }}>
                            {metric.value}
                        </Text>
                        <Text style={{
                            fontFamily: typography.fontStack,
                            fontSize: typography.sizes.small,
                            fontWeight: typography.weights.regular,
                            color: colors.textMuted,
                            lineHeight: typography.lineHeights.small,
                            textAlign: 'right',
                            margin: '0 0 28px 0',
                        }}>
                            {metric.sublabel}
                        </Text>

                        {hasHistory && (
                            <table role="presentation" width="100%" cellPadding="0" cellSpacing="0">
                                {/* Bar rows */}
                                <tr>
                                    {metric.bars!.map((bar, i) => {
                                        const barHeight = Math.max(BAR_MIN_HEIGHT, Math.round((bar.value / maxBarVal) * CHART_HEIGHT));
                                        const spacerHeight = CHART_HEIGHT - barHeight;
                                        return (
                                            <td key={i} style={{ verticalAlign: 'bottom', textAlign: 'center', padding: '0 12px', width: '25%' }}>
                                                <table role="presentation" width="100%" cellPadding="0" cellSpacing="0">
                                                    <tr>
                                                        <td style={{ height: `${spacerHeight}px`, fontSize: '0', lineHeight: '0' }}>&nbsp;</td>
                                                    </tr>
                                                    <tr>
                                                        <td style={{
                                                            height: `${barHeight}px`,
                                                            backgroundColor: bar.isCurrent ? '#71717A' : colors.border,
                                                            borderRadius: '2px 2px 0 0',
                                                            fontSize: '0',
                                                            lineHeight: '0',
                                                        }}>&nbsp;</td>
                                                    </tr>
                                                </table>
                                            </td>
                                        );
                                    })}
                                </tr>
                                {/* Label row */}
                                <tr>
                                    {metric.bars!.map((bar, i) => (
                                        <td key={i} style={{
                                            textAlign: 'center',
                                            fontFamily: typography.fontStack,
                                            fontSize: '10px',
                                            color: bar.isCurrent ? colors.textSecondary : colors.textMuted,
                                            paddingTop: '4px',
                                            width: '25%',
                                            overflow: 'hidden',
                                        }}>
                                            {bar.label}
                                        </td>
                                    ))}
                                </tr>
                            </table>
                        )}
                    </td>
                </tr>
            </table>
        </div>
    );
}
