import { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabaseClient";
import { upsertListing } from "@/lib/listings";
import { geocodeAddress, searchAddressSuggestions, type GeocodeResult } from "@/lib/geocoding";
import { getCitiesForCountry, HOST_LOCATION_OPTIONS } from "@/lib/locationOptions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const PHOTO_BUCKET = "couch-photos";
const generateFileName = (file: File) => {
  const ext = file.name.split(".").pop();
  const random = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
  return `${random}${ext ? `.${ext}` : ""}`;
};

const uploadFileToBucket = async (
  bucket: string,
  file: File,
  userId: string,
  category: string,
) => {
  const fileName = generateFileName(file);
  const filePath = `${userId}/${category}/${fileName}`;

  const { error } = await supabase.storage
    .from(bucket)
    .upload(filePath, file, { cacheControl: "3600", upsert: false });

  if (error) {
    throw new Error(`Failed to upload ${category.replace("-", " ")} file: ${error.message}`);
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
  if (!data?.publicUrl) {
    throw new Error("Unable to resolve uploaded file URL");
  }
  return data.publicUrl;
};

const HostOnboarding = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();

  const locationState = location.state as { hostAddress?: string; coordinates?: GeocodeResult } | null;
  const prefilledAddress = locationState?.hostAddress ?? "";
  const prefilledCoordinates = locationState?.coordinates ?? null;

  const [addressQuery, setAddressQuery] = useState(prefilledAddress);
  const [addressSuggestions, setAddressSuggestions] = useState<GeocodeResult[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<GeocodeResult | null>(prefilledCoordinates);
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);
  const [couchPhotos, setCouchPhotos] = useState<File[]>([]);
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [loading, setLoading] = useState(false);
  const cityOptions = useMemo(() => getCitiesForCountry(country), [country]);

  useEffect(() => {
    if (!city) return;
    if (!cityOptions.includes(city)) {
      setCity("");
    }
  }, [city, cityOptions]);

  const handlePhotoChange = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) {
      setCouchPhotos([]);
      return;
    }
    const files = Array.from(fileList).slice(0, 3);
    if (files.length < fileList.length) {
      toast({
        title: "Photo limit",
        description: "You can upload up to 3 photos.",
      });
    }
    setCouchPhotos(files);
  };

  useEffect(() => {
    if (!addressQuery.trim() || addressQuery.trim().length < 3) {
      setAddressSuggestions([]);
      setIsSearchingAddress(false);
      return;
    }

    if (selectedAddress && selectedAddress.displayName === addressQuery.trim()) {
      setAddressSuggestions([]);
      setIsSearchingAddress(false);
      return;
    }

    const controller = new AbortController();
    setIsSearchingAddress(true);

    const timeout = setTimeout(async () => {
      try {
        const results = await searchAddressSuggestions(addressQuery, { signal: controller.signal });
        setAddressSuggestions(results);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          console.warn("Address lookup failed", error);
        }
      } finally {
        setIsSearchingAddress(false);
      }
    }, 300);

    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, [addressQuery, selectedAddress]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!couchPhotos.length) {
      toast({
        title: "Add couch photos",
        description: "Upload at least one photo to showcase your space.",
        variant: "destructive",
      });
      return;
    }

    const trimmedCountry = country.trim();
    const trimmedCity = city.trim();
    const trimmedAddress = addressQuery.trim();

    if (!trimmedCountry || !trimmedCity) {
      toast({
        title: "Add your city and country",
        description: "Let students know where they'll be staying.",
        variant: "destructive",
      });
      return;
    }

    if (!trimmedAddress) {
      toast({
        title: "Street address required",
        description: "Enter the street and number so we can verify your location.",
        variant: "destructive",
      });
      return;
    }

    let confirmedAddress = selectedAddress;
    if (!confirmedAddress) {
      confirmedAddress = await geocodeAddress(addressQuery);
      if (confirmedAddress) {
        setSelectedAddress(confirmedAddress);
        setAddressQuery(confirmedAddress.displayName);
      }
    }

    if (!confirmedAddress) {
      toast({
        title: "We couldn't find that address",
        description: "Please choose one of the suggested results.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      if (!user?.id || !user?.email) {
        throw new Error("You must be signed in to publish a listing.");
      }

      const photoUrls: string[] = [];
      for (let index = 0; index < Math.min(couchPhotos.length, 3); index += 1) {
        const photo = couchPhotos[index];
        const category = index === 0 ? "primary" : `gallery-${index}`;
        const url = await uploadFileToBucket(PHOTO_BUCKET, photo, user.id, category);
        photoUrls.push(url);
      }
      const primaryPhoto = photoUrls[0];
      if (!primaryPhoto) {
        throw new Error("At least one photo is required.");
      }

      const listingId = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${user.id}-${Date.now()}`;

      await upsertListing({
        id: listingId,
        hostId: user.id,
        hostName: user.full_name ?? user.email ?? "Host",
        hostEmail: user.email ?? null,
        title: user.full_name ? `${user.full_name}'s couch` : "Hosted couch",
        imageUrl: primaryPhoto,
        pricePerNight: "0",
        location: confirmedAddress.displayName,
        description: "Host onboarding listing",
        availability: {
          start: null,
          end: null,
          checkInTime: null,
          country: trimmedCountry,
          city: trimmedCity,
          addressLine: trimmedAddress,
          coordinates: confirmedAddress,
          photos: photoUrls,
        },
      });

      window.dispatchEvent(new Event("listings-updated"));

      toast({
        title: "Listing saved",
        description: "We have your address and photo on file.",
      });

      navigate("/listings");
    } catch (error) {
      console.error("Failed to create listing", error);
      toast({
        title: "Unable to create listing",
        description:
          error instanceof Error ? error.message : "Please try again after a moment.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dreamy-bg min-h-screen w-full px-4 pb-16 pt-6 sm:py-10" style={{ minHeight: "100dvh" }}>
      <div className="mx-auto w-full max-w-2xl">
        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle>Complete Your Host Profile</CardTitle>
            <CardDescription>
              Add up to three couch photos and confirm your address so renters can discover you.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="couchPhoto">
                  Couch photos <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="couchPhoto"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(event) => handlePhotoChange(event.target.files)}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Add 1-3 clear photos. The first photo becomes your cover image.
                </p>
                {couchPhotos.length > 0 && (
                  <p className="text-sm text-muted-foreground">
                    Selected ({couchPhotos.length}/3): {couchPhotos.map((file) => file.name).join(", ")}
                  </p>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="country">
                    Country <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={country || undefined}
                    onValueChange={(value) => {
                      setCountry(value);
                      setCity("");
                    }}
                  >
                    <SelectTrigger id="country" className="w-full">
                      <SelectValue placeholder="Choose the country where you host" />
                    </SelectTrigger>
                    <SelectContent>
                      {HOST_LOCATION_OPTIONS.map((option) => (
                        <SelectItem key={option.country} value={option.country}>
                          {option.country}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Pick the country that best matches your address.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city">
                    City <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={city || undefined}
                    onValueChange={setCity}
                    disabled={!country}
                  >
                    <SelectTrigger id="city" className="w-full" disabled={!country}>
                      <SelectValue placeholder={country ? "Choose closest city" : "Select a country first"} />
                    </SelectTrigger>
                    <SelectContent>
                      {cityOptions.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {country ? "Select the city renters will recognize." : "Choose a country to see available cities."}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Street address <span className="text-destructive">*</span></Label>
                <Input
                  id="address"
                  value={addressQuery}
                  onChange={(event) => {
                    setAddressQuery(event.target.value);
                    setSelectedAddress(null);
                  }}
                  placeholder="Start typing your street and number"
                  autoComplete="off"
                  required
                />
                {prefilledAddress && (
                  <p className="text-xs text-muted-foreground">
                    Prefilled from sign-up. Update it here if anything has changed.
                  </p>
                )}
                {(() => {
                  const trimmed = addressQuery.trim();
                  const shouldShow =
                    trimmed.length >= 3
                    && (isSearchingAddress || addressSuggestions.length > 0 || !selectedAddress);
                  if (!shouldShow) {
                    return null;
                  }
                  return (
                    <div className="max-h-48 overflow-y-auto rounded-md border bg-background">
                      {isSearchingAddress && (
                        <p className="px-3 py-2 text-xs text-muted-foreground">Searching addresses…</p>
                      )}
                      {!isSearchingAddress && addressSuggestions.length === 0 && !selectedAddress && (
                        <p className="px-3 py-2 text-xs text-muted-foreground">No matches yet. Try refining your address.</p>
                      )}
                      {addressSuggestions.map((suggestion) => (
                        <button
                          key={`${suggestion.lat}-${suggestion.lng}`}
                          type="button"
                          className={`block w-full px-3 py-2 text-left text-sm hover:bg-muted ${
                            selectedAddress?.displayName === suggestion.displayName ? "bg-muted" : ""
                          }`}
                          onClick={() => {
                            setSelectedAddress(suggestion);
                            setAddressQuery(suggestion.displayName);
                            setAddressSuggestions([]);
                          }}
                        >
                          {suggestion.displayName}
                        </button>
                      ))}
                    </div>
                  );
                })()}
                {selectedAddress && (
                  <p className="text-xs text-emerald-600">Address confirmed ✔️</p>
                )}
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
