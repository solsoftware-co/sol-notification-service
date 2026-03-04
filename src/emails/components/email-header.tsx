import { Section, Text } from '@react-email/components';
import { colors, typography, spacing } from '../styles';

type EmailHeaderProps = {
    subheader: string;
    header: string;
    periodLabel?: string;
};

export function EmailHeader({ subheader, header, periodLabel }: EmailHeaderProps) {
    return (
        <Section style={{ textAlign: 'center', paddingTop: spacing.md, paddingBottom: spacing.lg }}>
            <Text style={{
                fontFamily: typography.fontStack,
                fontSize: typography.sizes.small,
                fontWeight: typography.weights.regular,
                color: colors.textMuted,
                lineHeight: typography.lineHeights.small,
                margin: '0 0 6px 0',
            }}>
                {subheader}
            </Text>
            <Text style={{
                fontFamily: typography.fontStack,
                fontSize: typography.sizes.h1,
                fontWeight: typography.weights.bold,
                color: colors.textPrimary,
                lineHeight: typography.lineHeights.heading,
                letterSpacing: typography.letterSpacing.tight,
                margin: '0',
            }}>
                {header}
            </Text>
            {periodLabel && (
                <Text style={{
                    fontFamily: typography.fontStack,
                    fontSize: typography.sizes.body,
                    fontWeight: typography.weights.regular,
                    color: colors.textSecondary,
                    lineHeight: typography.lineHeights.small,
                    margin: '6px 0 0 0',
                }}>
                    {periodLabel}
                </Text>
            )}
        </Section>
    );
}
