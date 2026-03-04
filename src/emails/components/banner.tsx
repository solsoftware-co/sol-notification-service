import { Img } from '@react-email/components';
import { spacing } from '../styles';

export function Banner() {
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
                        height="40"
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
