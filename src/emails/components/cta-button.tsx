import { Section } from '@react-email/components';
import { colors, typography, radii, spacing } from '../styles';

type CTAButtonProps = {
    href: string;
    label: string;
    variant?: 'primary' | 'secondary';
};

export function CTAButton({ href, label, variant = 'primary' }: CTAButtonProps) {
    const isPrimary = variant === 'primary';

    return (
        <Section style={{ textAlign: 'center', paddingTop: spacing.md }}>
            {/* Bulletproof table-based button for Outlook compatibility */}
            <table role="presentation" cellPadding="0" cellSpacing="0" style={{ margin: '0 auto' }}>
                <tr>
                    <td style={{
                        backgroundColor: isPrimary ? colors.accent : 'transparent',
                        borderRadius: radii.button,
                        border: isPrimary ? 'none' : `1.5px solid ${colors.accent}`,
                    }}>
                        <a
                            href={href}
                            style={{
                                display: 'inline-block',
                                fontFamily: typography.fontStack,
                                fontSize: typography.sizes.body,
                                fontWeight: typography.weights.medium,
                                color: isPrimary ? '#FFFFFF' : colors.accent,
                                textDecoration: 'none',
                                padding: '12px 24px',
                                borderRadius: radii.button,
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
