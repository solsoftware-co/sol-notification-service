import { Row, Column, Text, Link } from '@react-email/components';
import { colors, typography, spacing } from '../styles';
import { LabelText } from './label-text';

type Field = {
    label: string;
    value: string;
    href?: string;
};

type FieldGroupProps = {
    fields: Field[];
};

function FieldCell({ label, value, href }: Field) {
    return (
        <div style={{ paddingBottom: spacing.md }}>
            <LabelText style={{ margin: '0 0 2px 0' }}>{label}</LabelText>
            {href ? (
                <Link href={href} style={{
                    fontFamily: typography.fontStack,
                    fontSize: typography.sizes.body,
                    fontWeight: typography.weights.regular,
                    color: colors.accent,
                    lineHeight: typography.lineHeights.body,
                    textDecoration: 'none',
                    display: 'block',
                }}>
                    {value}
                </Link>
            ) : (
                <Text style={{
                    fontFamily: typography.fontStack,
                    fontSize: typography.sizes.body,
                    fontWeight: typography.weights.regular,
                    color: colors.textPrimary,
                    lineHeight: typography.lineHeights.body,
                    margin: '0',
                }}>
                    {value}
                </Text>
            )}
        </div>
    );
}

export function FieldGroup({ fields }: FieldGroupProps) {
    // Pair fields into rows of 2
    const pairs: Array<[Field, Field | undefined]> = [];
    for (let i = 0; i < fields.length; i += 2) {
        pairs.push([fields[i], fields[i + 1]]);
    }

    return (
        <div>
            {pairs.map(([left, right], idx) => (
                <Row key={idx}>
                    <Column style={{ width: '50%', paddingRight: spacing.sm, verticalAlign: 'top' }}>
                        <FieldCell {...left} />
                    </Column>
                    <Column style={{ width: '50%', paddingLeft: spacing.sm, verticalAlign: 'top' }}>
                        {right && <FieldCell {...right} />}
                    </Column>
                </Row>
            ))}
        </div>
    );
}
