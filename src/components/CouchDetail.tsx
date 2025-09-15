import { useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, MapPin, Calendar, User } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CouchListing {
  id: string;
  image: string;
  price: string;
  title: string;
  host: string;
  location: string;
  availableDates: string;
  description: string;
}

const CouchDetail = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const couch = location.state?.couch as CouchListing;

  if (!couch) {
    navigate("/listings");
    return null;
  }

  return (
    <main className="min-h-screen bg-background">
      {/* Header with back button */}
      <header className="p-4 border-b border-sketch">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/listings")}
          className="p-2"
        >
          <ArrowLeft className="h-5 w-5 text-sketch-blue" />
        </Button>
      </header>

      {/* Content */}
      <div className="p-4 space-y-6">
        {/* Main Image */}
        <div className="sketch-card p-0 overflow-hidden">
          <img
            src={couch.image}
            alt={couch.title}
            className="w-full h-48 object-cover"
          />
        </div>

        {/* Title and Price */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-sketch-dark">
            {couch.title}
          </h1>
          <p className="text-3xl font-bold text-sketch-blue">
            {couch.price}
            <span className="text-sm text-muted-foreground ml-1">/ night</span>
          </p>
        </div>

        {/* Details */}
        <div className="space-y-4">
          {/* Host */}
          <div className="flex items-center gap-3 p-3 sketch-border rounded-lg">
            <User className="h-5 w-5 text-sketch-blue" />
            <div>
              <p className="text-sm text-muted-foreground">Host</p>
              <p className="font-medium text-sketch-dark">{couch.host}</p>
            </div>
          </div>

          {/* Location */}
          <div className="flex items-center gap-3 p-3 sketch-border rounded-lg">
            <MapPin className="h-5 w-5 text-sketch-blue" />
            <div>
              <p className="text-sm text-muted-foreground">Location</p>
              <p className="font-medium text-sketch-dark">{couch.location}</p>
            </div>
          </div>

          {/* Available Dates */}
          <div className="flex items-center gap-3 p-3 sketch-border rounded-lg">
            <Calendar className="h-5 w-5 text-sketch-blue" />
            <div>
              <p className="text-sm text-muted-foreground">Available</p>
              <p className="font-medium text-sketch-dark">{couch.availableDates}</p>
            </div>
          </div>
        </div>

        {/* Description */}
        <div className="p-4 sketch-border rounded-lg">
          <h3 className="font-medium text-sketch-dark mb-2">About this couch</h3>
          <p className="text-muted-foreground text-sm leading-relaxed">
            {couch.description}
          </p>
        </div>

        {/* Book Button */}
        <Button 
          className="w-full py-3 text-lg font-medium"
          size="lg"
        >
          Request Booking
        </Button>
      </div>
    </main>
  );
};

export default CouchDetail;