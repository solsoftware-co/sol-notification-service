import type { ReactNode } from 'react';
import { Container } from '@react-email/components';
import { colors, spacing, borders, radii } from '../styles';

type EmailContainerProps = {
    children: ReactNode;
};

export function EmailContainer({ children }: EmailContainerProps) {
    return (
        <Container style={{
            maxWidth: '800px',
            margin: '0 auto',
            backgroundColor: colors.surface,
            borderRadius: radii.container,
            border: borders.card,
            padding: spacing.lg,
            marginBottom: spacing.xl,
        }}>
            {children}
        </Container>
    );
}
