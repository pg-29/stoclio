import AuthForm from "../components/AuthForm.jsx";
export default function Login({ mode, onAuthenticated, onBack }) { return <AuthForm mode={mode} onAuthenticated={onAuthenticated} onBack={onBack} />; }
