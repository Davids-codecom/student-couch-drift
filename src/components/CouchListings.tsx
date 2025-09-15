import { useNavigate } from "react-router-dom";
import couch1 from "@/assets/couch1.jpg";
import couch2 from "@/assets/couch2.jpg";
import couch3 from "@/assets/couch3.jpg";
import couch4 from "@/assets/couch4.jpg";

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

const mockListings: CouchListing[] = [
  {
    id: "1",
    image: couch1,
    price: "$25",
    title: "Modern Blue Couch",
    host: "Sarah M.",
    location: "Downtown Campus",
    availableDates: "Oct 15-25",
    description: "Comfortable modern couch perfect for studying or relaxing. Located in a quiet apartment near campus."
  },
  {
    id: "2", 
    image: couch2,
    price: "$18",
    title: "Cozy Grey Sectional",
    host: "Mike T.",
    location: "North Dorms",
    availableDates: "Oct 20-30",
    description: "Spacious sectional with extra pillows. Great for overnight stays during exam week."
  },
  {
    id: "3",
    image: couch3,
    price: "$22",
    title: "Study Loveseat",
    host: "Emma K.",
    location: "Library District",
    availableDates: "Oct 18-28",
    description: "Perfect spot for late night study sessions. Close to the library and quiet."
  },
  {
    id: "4",
    image: couch4,
    price: "$30",
    title: "Convertible Futon",
    host: "Alex R.",
    location: "Student Village",
    availableDates: "Oct 16-26",
    description: "Converts to a bed for maximum comfort. Great for extended stays."
  }
];

const CouchListings = () => {
  const navigate = useNavigate();

  const handleCouchClick = (couch: CouchListing) => {
    navigate(`/couch/${couch.id}`, { state: { couch } });
  };

  return (
    <main className="min-h-screen bg-background px-4 py-6">
      {/* Header */}
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-sketch-dark text-center mb-2">
          Available Couches
        </h1>
        <p className="text-muted-foreground text-center text-sm">
          Find your perfect study spot
        </p>
      </header>

      {/* Grid of couch listings */}
      <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
        {mockListings.map((couch) => (
          <div
            key={couch.id}
            onClick={() => handleCouchClick(couch)}
            className="sketch-card p-3 cursor-pointer"
          >
            {/* Couch Image */}
            <div className="aspect-square rounded-lg overflow-hidden mb-3 bg-sketch-light">
              <img
                src={couch.image}
                alt={couch.title}
                className="w-full h-full object-cover"
              />
            </div>
            
            {/* Price */}
            <div className="text-center">
              <p className="text-xl font-bold text-sketch-blue mb-1">
                {couch.price}
              </p>
              <p className="text-xs text-muted-foreground">
                per night
              </p>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
};

export default CouchListings;