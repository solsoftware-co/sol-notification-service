import { Img } from '@react-email/components';
import { spacing } from '../styles';

export function Banner() {
    return (
        <table
            width="100%"
            role="presentation"
            style={{
                paddingTop: spacing.xl,
                paddingBottom: spacing.lg,
            }}
        >
            <tr>
                <td align="center">
                    <Img
                        src="cid:banner_image.png"
                        alt="Sol Software"
                        height="32"
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
