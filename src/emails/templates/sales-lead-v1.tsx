import { Html, Head, Preview, Body, Text, Link } from '@react-email/components';
import { Banner } from '../components/banner';
import { EmailContainer } from '../components/email-container';
import { EmailHeader } from '../components/email-header';
import { EmailFooter } from '../components/email-footer';
import { SectionDivider } from '../components/section-divider';
import { FieldGroup } from '../components/field-group';
import { MessageBlock } from '../components/message-block';
import { CTAButton } from '../components/cta-button';
import { colors, typography, spacing } from '../styles';

export type InquiryEmailProps = {
    previewText: string;
    subheader: string;
    header: string;
    customerName: string;
    customerEmail: string;
    comments: string;
    submittedAt: string;
    customerPhone?: string;
    interestedIn?: string;
    sourcePageText?: string;
    sourcePageLink?: string;
    logText?: string;
    logLink?: string;
};

export default function SalesLeadV1Email({
    previewText,
    subheader,
    header,
    customerName,
    customerEmail,
    comments,
    submittedAt,
    customerPhone,
    interestedIn,
    sourcePageText,
    sourcePageLink,
    logText,
    logLink,
}: InquiryEmailProps) {
    const fields = [
        { label: 'Name', value: customerName },
        { label: 'Email', value: customerEmail, href: `mailto:${customerEmail}` },
        ...(customerPhone ? [{ label: 'Phone', value: customerPhone, href: `tel:${customerPhone}` }] : []),
        ...(interestedIn ? [{ label: 'Interested In', value: interestedIn }] : []),
    ];

    const hasMetadata = !!(submittedAt || sourcePageLink || logLink);

    return (
        <Html>
            <Head>
                <Preview>{previewText}</Preview>
            </Head>
            <Body style={{ backgroundColor: colors.bg, margin: '0', padding: '0' }}>
                <Banner />

                <EmailContainer>
                    <EmailHeader subheader={subheader} header={header} />

                    <SectionDivider />

                    <FieldGroup fields={fields} />

                    {comments && <SectionDivider />}
                    {comments && <MessageBlock message={comments} />}

                    {hasMetadata && <SectionDivider />}
                    {hasMetadata && (
                        <div>
                            {submittedAt && (
                                <div style={{ marginBottom: spacing.sm }}>
                                    <Text style={{
                                        fontFamily: typography.fontStack,
                                        fontSize: typography.sizes.label,
                                        fontWeight: typography.weights.medium,
                                        color: colors.textMuted,
                                        letterSpacing: typography.letterSpacing.label,
                                        textTransform: 'uppercase',
                                        margin: '0 0 2px 0',
                                    }}>
                                        Submitted
                                    </Text>
                                    <Text style={{
                                        fontFamily: typography.fontStack,
                                        fontSize: typography.sizes.small,
                                        color: colors.textSecondary,
                                        margin: '0',
                                    }}>
                                        {submittedAt}
                                    </Text>
                                </div>
                            )}
                            {sourcePageLink && (
                                <div style={{ marginBottom: spacing.sm }}>
                                    <Text style={{
                                        fontFamily: typography.fontStack,
                                        fontSize: typography.sizes.label,
                                        fontWeight: typography.weights.medium,
                                        color: colors.textMuted,
                                        letterSpacing: typography.letterSpacing.label,
                                        textTransform: 'uppercase',
                                        margin: '0 0 2px 0',
                                    }}>
                                        Source Page
                                    </Text>
                                    <Link href={sourcePageLink} style={{
                                        fontFamily: typography.fontStack,
                                        fontSize: typography.sizes.small,
                                        color: colors.accent,
                                        textDecoration: 'none',
                                    }}>
                                        {sourcePageText ?? sourcePageLink}
                                    </Link>
                                </div>
                            )}
                            {logLink && (
                                <div>
                                    <Text style={{
                                        fontFamily: typography.fontStack,
                                        fontSize: typography.sizes.label,
                                        fontWeight: typography.weights.medium,
                                        color: colors.textMuted,
                                        letterSpacing: typography.letterSpacing.label,
                                        textTransform: 'uppercase',
                                        margin: '0 0 2px 0',
                                    }}>
                                        Activity Log
                                    </Text>
                                    <Link href={logLink} style={{
                                        fontFamily: typography.fontStack,
                                        fontSize: typography.sizes.small,
                                        color: colors.accent,
                                        textDecoration: 'none',
                                    }}>
                                        {logText ?? logLink}
                                    </Link>
                                </div>
                            )}
                        </div>
                    )}

                    <CTAButton
                        href={`mailto:${customerEmail}`}
                        label={`Reply to ${customerName}`}
                        variant="primary"
                    />

                    <EmailFooter />
                </EmailContainer>
            </Body>
        </Html>
    );
}
