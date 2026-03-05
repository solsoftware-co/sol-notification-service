import { Text } from '@react-email/components';
import { colors, typography, spacing, borders, radii } from '../styles';
import { LabelText } from './label-text';

export type StatMetric = {
    value: string;
    label: string;
    description: string;
    trend?: {
        direction: 'up' | 'neutral' | 'down';
        text: string;
    };
};

type StatCardProps = {
    metric: StatMetric;
};

export function StatCard({ metric }: StatCardProps) {
    const trendColor = metric.trend?.direction === 'up' ? colors.positive : colors.textMuted;

    return (
        <div style={{
            backgroundColor: colors.shading,
            border: borders.card,
            borderRadius: radii.card,
            padding: spacing.lg,
            marginBottom: spacing.md,
        }}>
            <LabelText>{metric.label}</LabelText>
            <Text style={{
                fontFamily: typography.fontStack,
                fontSize: typography.sizes.display,
                fontWeight: typography.weights.light,
                color: colors.textPrimary,
                lineHeight: typography.lineHeights.tight,
                letterSpacing: typography.letterSpacing.tight,
                margin: '0 0 4px 0',
            }}>
                {metric.value}
            </Text>
            {metric.trend && (
                <Text style={{
                    fontFamily: typography.fontStack,
                    fontSize: typography.sizes.small,
                    fontWeight: typography.weights.regular,
                    color: trendColor,
                    lineHeight: typography.lineHeights.small,
                    margin: '0 0 4px 0',
                }}>
                    {metric.trend.text}
                </Text>
            )}
            <Text style={{
                fontFamily: typography.fontStack,
                fontSize: typography.sizes.small,
                fontWeight: typography.weights.regular,
                color: colors.textSecondary,
                lineHeight: typography.lineHeights.small,
                margin: '0',
            }}>
                {metric.description}
            </Text>
        </div>
    );
}
