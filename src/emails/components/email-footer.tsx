import { Section, Text } from '@react-email/components';
import { colors, typography, spacing } from '../styles';

export function EmailFooter() {
    return (
        <Section style={{ paddingTop: spacing.xl, textAlign: 'center' }}>
            <Text style={{
                fontFamily: typography.fontStack,
                fontSize: typography.sizes.small,
                fontWeight: typography.weights.regular,
                color: colors.textMuted,
                lineHeight: typography.lineHeights.small,
                margin: '0',
            }}>
                © {new Date().getFullYear()} Sol Software · Sent automatically by the notification service
            </Text>
        </Section>
    );
}
