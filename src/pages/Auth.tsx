import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";

// Temporary mock authentication for testing
const Auth = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [userRole, setUserRole] = useState<"host" | "renter">("renter");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { refreshUser } = useAuth();

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !fullName) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    
    // Simulate API call delay
    setTimeout(() => {
      try {
        // Store user data in localStorage for now
        const userData = {
          id: Date.now().toString(),
          email,
          full_name: fullName,
          user_role: userRole,
          created_at: new Date().toISOString()
        };
        
        localStorage.setItem('currentUser', JSON.stringify(userData));
        
        // Refresh the auth context with new user data
        refreshUser();
        
        toast({
          title: "Success!",
          description: "Account created successfully.",
        });
        
        // Navigate based on user role
        if (userRole === "host") {
          navigate("/host-onboarding", { replace: true });
        } else {
          navigate("/listings", { replace: true });
        }
        
      } catch (error: any) {
        toast({
          title: "Signup Error",
          description: "Failed to create account. Please try again.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    }, 1000);
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    
    // Simulate API call delay
    setTimeout(() => {
      try {
        // For demo purposes, accept any email/password combination
        const userData = {
          id: Date.now().toString(),
          email,
          full_name: email.split('@')[0], // Use email prefix as name
          user_role: 'renter' as const,
          created_at: new Date().toISOString()
        };
        
        localStorage.setItem('currentUser', JSON.stringify(userData));
        
        // Refresh the auth context with new user data
        refreshUser();
        
        toast({
          title: "Success!",
          description: "Signed in successfully.",
        });
        
        navigate("/listings", { replace: true });
        
      } catch (error: any) {
        toast({
          title: "Error",
          description: "Failed to sign in. Please try again.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 to-secondary/10 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Welcome to CouchStay</CardTitle>
          <CardDescription>
            Connect with students and find affordable accommodation
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>
            
            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signin-email">Email</Label>
                  <Input
                    id="signin-email"
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signin-password">Password</Label>
                  <Input
                    id="signin-password"
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Signing in..." : "Sign In"}
                </Button>
              </form>
            </TabsContent>
            
            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fullname">Full Name</Label>
                  <Input
                    id="fullname"
                    type="text"
                    placeholder="Enter your full name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    placeholder="Create a password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-3">
                  <Label>I want to sign up as:</Label>
                  <RadioGroup
                    value={userRole}
                    onValueChange={(value) => setUserRole(value as "host" | "renter")}
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="renter" id="renter" />
                      <Label htmlFor="renter">Renter (looking for a couch)</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="host" id="host" />
                      <Label htmlFor="host">Host (offering my couch)</Label>
                    </div>
                  </RadioGroup>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Creating account..." : "Sign Up"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;