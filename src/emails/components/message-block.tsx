import { Section, Text } from '@react-email/components';
import { colors, typography, borders, spacing, radii } from '../styles';
import { LabelText } from './label-text';

type MessageBlockProps = {
    message: string;
    title?: string;
};

export function MessageBlock({ message, title = 'COMMENTS' }: MessageBlockProps) {
    return (
        <Section>
            <div style={{
                backgroundColor: colors.shading,
                borderRadius: radii.messageBlock,
                padding: spacing.md,
                border: borders.card,
            }}>
                {title && <LabelText>{title}</LabelText>}

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
