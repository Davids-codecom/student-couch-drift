import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const HostOnboarding = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [formData, setFormData] = useState({
    address: "",
    propertyType: "flat" as "house" | "flat",
    pricePerNight: "",
    checkInTime: "",
  });
  
  const [files, setFiles] = useState({
    couchPhotos: [] as File[],
    selfie: null as File | null,
    idPassport: null as File | null,
    enrollmentDoc: null as File | null,
    studentCard: null as File | null,
  });
  
  const [loading, setLoading] = useState(false);

  const handleFileChange = (field: keyof typeof files, fileList: FileList | null) => {
    if (!fileList) return;
    
    if (field === "couchPhotos") {
      const filesArray = Array.from(fileList);
      if (filesArray.length < 3 || filesArray.length > 10) {
        toast({
          title: "Invalid number of photos",
          description: "Please upload between 3 and 10 photos of your couch",
          variant: "destructive",
        });
        return;
      }
      setFiles(prev => ({ ...prev, couchPhotos: filesArray }));
    } else {
      setFiles(prev => ({ ...prev, [field]: fileList[0] }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate all required fields
    if (!formData.address || !formData.pricePerNight || !formData.checkInTime) {
      toast({
        title: "Missing information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }
    
    if (files.couchPhotos.length < 3) {
      toast({
        title: "Missing photos",
        description: "Please upload at least 3 photos of your couch",
        variant: "destructive",
      });
      return;
    }
    
    if (!files.selfie || !files.idPassport || !files.enrollmentDoc || !files.studentCard) {
      toast({
        title: "Missing documents",
        description: "Please upload all required documents",
        variant: "destructive",
      });
      return;
    }
    
    if (!user?.id) {
      toast({
        title: "Authentication required",
        description: "Please sign in again to continue.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const documentMetadata = {
        couchPhotos: files.couchPhotos.map((file, index) => ({
          name: file.name,
          size: file.size,
          type: file.type,
          order: index,
        })),
        selfie: files.selfie
          ? {
              name: files.selfie.name,
              size: files.selfie.size,
              type: files.selfie.type,
            }
          : null,
        idPassport: files.idPassport
          ? {
              name: files.idPassport.name,
              size: files.idPassport.size,
              type: files.idPassport.type,
            }
          : null,
        enrollmentDoc: files.enrollmentDoc
          ? {
              name: files.enrollmentDoc.name,
              size: files.enrollmentDoc.size,
              type: files.enrollmentDoc.type,
            }
          : null,
        studentCard: files.studentCard
          ? {
              name: files.studentCard.name,
              size: files.studentCard.size,
              type: files.studentCard.type,
            }
          : null,
      };

      const { error } = await supabase.from("host_listings").insert({
        user_id: user.id,
        address: formData.address,
        property_type: formData.propertyType,
        price_per_night: Number(formData.pricePerNight),
        check_in_time: formData.checkInTime,
        document_metadata: documentMetadata,
        status: "pending",
      });

      if (error) {
        throw error;
      }

      toast({
        title: "Success!",
        description: "Your listing has been created successfully",
      });

      navigate("/listings");
    } catch (error: any) {
      console.error("Error saving host listing:", error);
      toast({
        title: "Submission failed",
        description: error?.message || "We couldn't save your information. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 to-secondary/10 p-4">
      <div className="max-w-2xl mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle>Complete Your Host Profile</CardTitle>
            <CardDescription>
              Upload all required documents and information to start hosting
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Couch Photos */}
              <div className="space-y-2">
                <Label htmlFor="couchPhotos">
                  Couch Photos <span className="text-destructive">*</span>
                  <span className="text-sm text-muted-foreground ml-2">(3-10 photos)</span>
                </Label>
                <Input
                  id="couchPhotos"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => handleFileChange("couchPhotos", e.target.files)}
                  required
                />
                {files.couchPhotos.length > 0 && (
                  <p className="text-sm text-muted-foreground">
                    {files.couchPhotos.length} photo(s) selected
                  </p>
                )}
              </div>

              {/* Selfie */}
              <div className="space-y-2">
                <Label htmlFor="selfie">
                  Selfie/Portrait <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="selfie"
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileChange("selfie", e.target.files)}
                  required
                />
              </div>

              {/* ID/Passport */}
              <div className="space-y-2">
                <Label htmlFor="idPassport">
                  ID or Passport <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="idPassport"
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => handleFileChange("idPassport", e.target.files)}
                  required
                />
              </div>

              {/* University Enrollment */}
              <div className="space-y-2">
                <Label htmlFor="enrollmentDoc">
                  University Enrollment Document <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="enrollmentDoc"
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => handleFileChange("enrollmentDoc", e.target.files)}
                  required
                />
              </div>

              {/* Student Card */}
              <div className="space-y-2">
                <Label htmlFor="studentCard">
                  Student Card <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="studentCard"
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => handleFileChange("studentCard", e.target.files)}
                  required
                />
              </div>

              {/* Address */}
              <div className="space-y-2">
                <Label htmlFor="address">
                  Address <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="address"
                  type="text"
                  placeholder="Enter your apartment address"
                  value={formData.address}
                  onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                  required
                />
              </div>

              {/* Property Type */}
              <div className="space-y-3">
                <Label>Property Type <span className="text-destructive">*</span></Label>
                <RadioGroup
                  value={formData.propertyType}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, propertyType: value as "house" | "flat" }))}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="flat" id="flat" />
                    <Label htmlFor="flat">Flat</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="house" id="house" />
                    <Label htmlFor="house">House</Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Price Per Night */}
              <div className="space-y-2">
                <Label htmlFor="pricePerNight">
                  Price Per Night (€) <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="pricePerNight"
                  type="number"
                  min="1"
                  placeholder="e.g., 25"
                  value={formData.pricePerNight}
                  onChange={(e) => setFormData(prev => ({ ...prev, pricePerNight: e.target.value }))}
                  required
                />
              </div>

              {/* Check-in Time */}
              <div className="space-y-2">
                <Label htmlFor="checkInTime">
                  Check-in Time <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="checkInTime"
                  type="time"
                  value={formData.checkInTime}
                  onChange={(e) => setFormData(prev => ({ ...prev, checkInTime: e.target.value }))}
                  required
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Creating your listing..." : "Complete Setup"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default HostOnboarding;
