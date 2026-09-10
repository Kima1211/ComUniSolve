import { Link } from "react-router-dom";

function AuthPanel() {
return(
    <div> 
        <Link to="/login">Log In</Link>
        <Link to="/register">Register</Link>
    </div>
)

}
export default AuthPanel