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

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="text-center space-y-8 max-w-sm">
        {/* Logo - Simple sketch-style couch icon */}
        <div className="mx-auto w-24 h-24 rounded-lg bg-sketch-light border-2 border-sketch relative sketch-border flex items-center justify-center">
          <div className="text-4xl text-sketch-blue">🛋️</div>
        </div>
        
        {/* App Name */}
        <div className="space-y-2">
          <h1 className="text-4xl font-bold text-sketch-dark tracking-wide">
            Couch Surfing
          </h1>
          <p className="text-lg text-muted-foreground">
            Student to Student
          </p>
        </div>
      </div>
    </main>
  );
};

export default SplashScreen;