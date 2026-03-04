import { Section } from '@react-email/components';
import { colors, typography, radii, spacing } from '../styles';

type CTAButtonProps = {
    href: string;
    label: string;
    variant?: 'primary' | 'secondary' | 'black';
    size?: 'sm' | 'md' | 'lg';
    radius?: 'default' | 'rounded';
};

const variantStyles: Record<NonNullable<CTAButtonProps['variant']>, {
    bg: string;
    textColor: string;
    border: string;
}> = {
    primary:   { bg: colors.accent,       textColor: '#FFFFFF',       border: 'none' },
    secondary: { bg: 'transparent',       textColor: colors.accent,   border: `1.5px solid ${colors.accent}` },
    black:     { bg: colors.textPrimary,  textColor: '#FFFFFF',       border: 'none' },
};

const sizeStyles: Record<NonNullable<CTAButtonProps['size']>, string> = {
    sm: '8px 16px',
    md: '12px 24px',
    lg: '21px 42px',
};

const radiusStyles: Record<NonNullable<CTAButtonProps['radius']>, string> = {
    default: radii.button,
    rounded: '9999px',
};

export function CTAButton({ href, label, variant = 'primary', size = 'md', radius = 'default' }: CTAButtonProps) {
    const { bg, textColor, border } = variantStyles[variant];
    const padding = sizeStyles[size];
    const borderRadius = radiusStyles[radius];

    return (
        <Section style={{ textAlign: 'center', paddingTop: spacing.md }}>
            {/* Bulletproof table-based button for Outlook compatibility */}
            <table role="presentation" cellPadding="0" cellSpacing="0" style={{ margin: '0 auto' }}>
                <tr>
                    <td style={{
                        backgroundColor: bg,
                        borderRadius,
                        border,
                    }}>
                        <a
                            href={href}
                            style={{
                                display: 'inline-block',
                                fontFamily: typography.fontStack,
                                fontSize: typography.sizes.body,
                                fontWeight: typography.weights.medium,
                                color: textColor,
                                textDecoration: 'none',
                                padding,
                                borderRadius,
                            }}
                        >
                            {label}
                        </a>
                    </td>
                </tr>
            </table>
        </Section>
    );
}
