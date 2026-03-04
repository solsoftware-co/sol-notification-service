import type { ReactNode } from 'react';
import { Container } from '@react-email/components';
import { colors, spacing, borders, radii } from '../styles';

type EmailContainerProps = {
    children: ReactNode;
};

export function EmailContainer({ children }: EmailContainerProps) {
    return (
        <Container style={{
            maxWidth: '600px',
            margin: '0 auto',
            backgroundColor: colors.surface,
            borderRadius: radii.card,
            border: borders.card,
            padding: spacing.lg,
            marginBottom: spacing.xl,
        }}>
            {children}
        </Container>
    );
}
