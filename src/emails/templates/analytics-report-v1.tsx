import { Html, Head, Preview, Body, Section, Row, Column, Img, Text } from '@react-email/components';
import { colors, typography, spacing } from '../styles';
import { Banner } from '../components/banner';
import { EmailContainer } from '../components/email-container';
import { EmailHeader } from '../components/email-header';
import { EmailFooter } from '../components/email-footer';
import { SectionDivider } from '../components/section-divider';
import { StatCard } from '../components/stat-card';
import type { StatMetric } from '../components/stat-card';
import { DataTable } from '../components/data-table';
import { ChartCard } from '../components/chart-card';

export type { StatMetric };

export type AnalyticsEmailProps = {
    previewText: string;
    subheader: string;
    header: string;
    periodLabel: string;
    sessions: StatMetric;
    avgDuration: StatMetric;
    activeUsers: StatMetric;
    newUsers: StatMetric;
    topSources: Array<{ source: string; category: string; sessions: string }>;
    topPages: Array<{ name: string; path: string; views: string }>;
    dailyMetrics: Array<{ date: string; sessions: string; activeUsers: string; newUsers: string }>;
    dailyChart?: string;
    sourcesGauges?: Array<{ cid: string; label: string; pct: number; sessions: string }>;
    pagesChart?: string;
};

export default function AnalyticsReportV1Email({
    previewText,
    subheader,
    header,
    periodLabel,
    sessions,
    avgDuration,
    activeUsers,
    newUsers,
    topSources = [],
    topPages = [],
    dailyMetrics = [],
    dailyChart,
    sourcesGauges,
    pagesChart,
}: AnalyticsEmailProps) {
    return (
        <Html>
            <Head>
                <Preview>{previewText}</Preview>
            </Head>
            <Body style={{ backgroundColor: colors.bg, margin: '0', padding: '0' }}>
                <Banner />
                <EmailContainer>
                    <EmailHeader subheader={subheader} header={header} periodLabel={periodLabel} />
                    <SectionDivider />

                    <StatCard metric={sessions} />
                    <StatCard metric={avgDuration} />
                    <StatCard metric={activeUsers} />
                    <StatCard metric={newUsers} />

                    {topSources.length > 0 && (
                        <>
                            <SectionDivider />
                        {sourcesGauges && sourcesGauges.length > 0 && (
                            <Section style={{ marginBottom: '16px' }}>
                                <Text style={{
                                    fontFamily: typography.fontStack,
                                    fontSize: typography.sizes.h2,
                                    fontWeight: typography.weights.medium,
                                    color: colors.textPrimary,
                                    margin: `0 0 ${spacing.sm} 0`,
                                    lineHeight: typography.lineHeights.heading,
                                }}>
                                    Traffic Sources
                                </Text>
                                <Text style={{
                                    fontFamily: typography.fontStack,
                                    fontSize: typography.sizes.small,
                                    fontWeight: typography.weights.regular,
                                    color: colors.textSecondary,
                                    lineHeight: typography.lineHeights.small,
                                    margin: `0 0 ${spacing.md} 0`,
                                }}>
                                    Session share by traffic category
                                </Text>
                                <Row>
                                    {sourcesGauges.map((g, i) => (
                                        <Column key={i} style={{ textAlign: 'center', width: '33%' }}>
                                            <Img src={g.cid} width="180" alt={g.label} style={{ display: 'block', margin: '0 auto' }} />
                                            <Text style={{
                                                fontFamily: typography.fontStack,
                                                fontSize: typography.sizes.display,
                                                fontWeight: typography.weights.regular,
                                                color: colors.textPrimary,
                                                lineHeight: typography.lineHeights.tight,
                                                letterSpacing: typography.letterSpacing.tight,
                                                margin: '0 0 4px 0',
                                                textAlign: 'center',
                                            }}>
                                                {g.pct}%
                                            </Text>
                                            <Text style={{
                                                fontFamily: typography.fontStack,
                                                fontSize: typography.sizes.small,
                                                fontWeight: typography.weights.regular,
                                                color: colors.textSecondary,
                                                lineHeight: typography.lineHeights.small,
                                                textAlign: 'center',
                                                margin: '0 0 2px 0',
                                            }}>
                                                {g.sessions}
                                            </Text>
                                            <Text style={{
                                                fontFamily: typography.fontStack,
                                                fontSize: typography.sizes.small,
                                                fontWeight: typography.weights.regular,
                                                color: colors.textMuted,
                                                lineHeight: typography.lineHeights.small,
                                                textAlign: 'center',
                                                margin: '0 0 12px 0',
                                            }}>
                                                {g.label}
                                            </Text>
                                        </Column>
                                    ))}
                                </Row>
                            </Section>
                        )}
                            <DataTable
                                columns={['Source', 'Category', 'Sessions']}
                                rows={topSources.map(s => [s.source, s.category, s.sessions])}
                                align={['left', 'left', 'right']}
                            />
                        </>
                    )}

                    {topPages.length > 0 && (
                        <>
                            <SectionDivider />
                            {pagesChart && (
                                <ChartCard
                                    image={pagesChart}
                                    title="Top Pages"
                                    description="Page views by path"
                                />
                            )}
                            <DataTable
                                columns={['Page', 'Path', 'Views']}
                                rows={topPages.map(p => [p.name, p.path, p.views])}
                                align={['left', 'left', 'right']}
                            />
                        </>
                    )}

                    {dailyMetrics.length > 0 && (
                        <>
                            <SectionDivider />
                            {dailyChart && (
                                <ChartCard
                                    image={dailyChart}
                                    title="Daily Sessions"
                                    description="Sessions per day"
                                />
                            )}
                            <DataTable
                                title="Daily Breakdown"
                                columns={['Date', 'Sessions', 'Active Users', 'New Users']}
                                rows={dailyMetrics.map(d => [d.date, d.sessions, d.activeUsers, d.newUsers])}
                            />
                        </>
                    )}

                    <SectionDivider />
                    <EmailFooter />
                </EmailContainer>
            </Body>
        </Html>
    );
}
