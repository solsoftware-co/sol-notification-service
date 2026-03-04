import { Text, Img } from '@react-email/components';
import { colors, typography, spacing, borders, radii } from '../styles';

type ChartCardProps = {
    title: string;
    image: string;
    description: string;
};

export function ChartCard({ title, image, description }: ChartCardProps) {
    return (
        <div style={{
            backgroundColor: colors.surface,
            border: borders.card,
            borderRadius: radii.card,
            padding: spacing.lg,
            marginBottom: spacing.md,
        }}>
            <Text style={{
                fontFamily: typography.fontStack,
                fontSize: typography.sizes.h2,
                fontWeight: typography.weights.medium,
                color: colors.textPrimary,
                margin: `0 0 ${spacing.sm} 0`,
                lineHeight: typography.lineHeights.heading,
            }}>
                {title}
            </Text>
            <Text style={{
                fontFamily: typography.fontStack,
                fontSize: typography.sizes.small,
                fontWeight: typography.weights.regular,
                color: colors.textSecondary,
                lineHeight: typography.lineHeights.small,
                margin: `0 0 ${spacing.md} 0`,
            }}>
                {description}
            </Text>
            <Img src={image} alt={title} width="100%" />
        </div>
    );
}
