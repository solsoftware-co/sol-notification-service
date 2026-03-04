import { Section, Text } from '@react-email/components';
import { colors, typography, borders, spacing } from '../styles';

type MessageBlockProps = {
    message: string;
};

export function MessageBlock({ message }: MessageBlockProps) {
    return (
        <Section>
            <div style={{
                backgroundColor: colors.bg,
                borderLeft: borders.messageAccent,
                borderRadius: '0 4px 4px 0',
                padding: spacing.md,
            }}>
                <Text style={{
                    fontFamily: typography.fontStack,
                    fontSize: typography.sizes.body,
                    fontWeight: typography.weights.regular,
                    color: colors.textPrimary,
                    lineHeight: typography.lineHeights.body,
                    whiteSpace: 'pre-wrap',
                    margin: '0',
                }}>
                    {message}
                </Text>
            </div>
        </Section>
    );
}
