import { Text } from '@react-email/components';
import { colors, typography } from '../styles';
import { CSSProperties } from 'react';

type LabelTextProps = {
    children: React.ReactNode;
    style?: CSSProperties;
};

export function LabelText({ children, style }: LabelTextProps) {
    return (
        <Text style={{
            fontFamily: typography.fontStack,
            fontSize: typography.sizes.label,
            fontWeight: typography.weights.medium,
            color: colors.textMuted,
            letterSpacing: typography.letterSpacing.label,
            textTransform: 'uppercase',
            margin: '0 0 4px 0',
            lineHeight: typography.lineHeights.small,
            ...style,
        }}>
            {children}
        </Text>
    );
}
