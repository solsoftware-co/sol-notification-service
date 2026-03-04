import { Hr, Section } from '@react-email/components';
import { borders, spacing } from '../styles';

export function SectionDivider() {
    return (
        <Section style={{ paddingTop: spacing.lg, paddingBottom: spacing.lg }}>
            <Hr style={{ border: 'none', borderTop: borders.tableRow, margin: '0' }} />
        </Section>
    );
}
