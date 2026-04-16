import { Img } from '@react-email/components';
import { spacing } from '../styles';

export interface BannerProps {
    height?: number;
    width?: number;
}

export function Banner({ height, width }: BannerProps = {}) {
    return (
        <table
            width="100%"
            role="presentation"
            style={{
                paddingTop: spacing.xl,
                paddingBottom: spacing.xl,
            }}
        >
            <tr>
                <td align="center">
                    <Img
                        src="cid:banner_image.png"
                        alt="Sol Software"
                        {...(width !== undefined && height === undefined ? {} : { height: height ?? 40 })}
                        {...(width !== undefined ? { width } : {})}
                        style={{
                            display: 'block',
                            outline: 'none',
                            border: 'none',
                            textDecoration: 'none',
                        }}
                    />
                </td>
            </tr>
        </table>
    );
}
