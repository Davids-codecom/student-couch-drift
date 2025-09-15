import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
const SplashScreen = () => {
  const navigate = useNavigate();
  useEffect(() => {
    const handleClick = () => {
      navigate("/listings");
    };

    // Add click listener to entire screen
    document.addEventListener("click", handleClick);
    return () => {
      document.removeEventListener("click", handleClick);
    };
  }, [navigate]);
  return <main className="flex min-h-screen items-center justify-center bg-background px-4">
      
    </main>;
};
export default SplashScreen;