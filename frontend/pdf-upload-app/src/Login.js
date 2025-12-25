import { GoogleLogin } from '@react-oauth/google';

export default function Login({ onLogin }) {
    return (
        <div style={{ textAlign: 'center', marginTop: '120px' }}>
            <h2>Sign in to upload PDFs</h2>

            <GoogleLogin
                onSuccess={(credentialResponse) => {
                    onLogin(credentialResponse.credential);
                }}
                onError={() => {
                    alert('Login Failed');
                }}
            />
        </div>
    );
}
