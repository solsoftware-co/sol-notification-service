import { Html, Head, Preview, Body } from '@react-email/components';
import { colors } from '../styles';
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
    topSources: Array<{ source: string; sessions: string }>;
    topPages: Array<{ path: string; views: string }>;
    dailyMetrics: Array<{ date: string; sessions: string; activeUsers: string; newUsers: string }>;
    charts: Array<{ title: string; description: string; image: string }>;
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
    charts = [],
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
                            <DataTable
                                title="Top Sources"
                                columns={['Source', 'Sessions']}
                                rows={topSources.map(s => [s.source, s.sessions])}
                            />
                        </>
                    )}

                    {topPages.length > 0 && (
                        <>
                            <SectionDivider />
                            <DataTable
                                title="Top Pages"
                                columns={['Page', 'Views']}
                                rows={topPages.map(p => [p.path, p.views])}
                            />
                        </>
                    )}

                    {dailyMetrics.length > 0 && (
                        <>
                            <SectionDivider />
                            <DataTable
                                title="Daily Breakdown"
                                columns={['Date', 'Sessions', 'Active Users', 'New Users']}
                                rows={dailyMetrics.map(d => [d.date, d.sessions, d.activeUsers, d.newUsers])}
                            />
                        </>
                    )}

                    {charts.map((chart, i) => (
                        <ChartCard
                            key={i}
                            title={chart.title}
                            description={chart.description}
                            image={chart.image}
                        />
                    ))}

                    <SectionDivider />
                    <EmailFooter />
                </EmailContainer>
            </Body>
        </Html>
    );
}
