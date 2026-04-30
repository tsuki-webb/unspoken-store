initCollectionPage({
    key: "men",
    gender: "men",
    pageTitle: "Men Collection",
    heroEyebrow: "MENSWEAR EDIT",
    heroTitle: "MEN COLLECTION",
    heroSubtitle: "Built for everyday dominance with elevated basics and statement drops.",
    heroFallbackImage: "https://images.unsplash.com/photo-1520975916090-3105956dac38?auto=format&fit=crop&w=1800&q=80",
    bannerType: "menHero",
    quickTypes: [
        { value: "all", label: "All" },
        { value: "tshirt", label: "T-Shirts" },
        { value: "shirt", label: "Shirts" },
        { value: "short", label: "Shorts" },
        { value: "sweatpant", label: "Sweatpants" }
    ],
    hashAliases: {
        oversized: { sectionId: "tshirts", subcategoryId: "oversized" },
        regular: { sectionId: "tshirts", subcategoryId: "regular" }
    },
    categories: [
        {
            id: "tshirts",
            navLabel: "T-Shirts",
            title: "T-Shirts",
            subtitle: "Core silhouettes with versatile fits for every day.",
            type: "tshirt",
            cardAliases: ["oversized", "regular"],
            subcategories: [
                {
                    id: "all",
                    navLabel: "All Fits",
                    title: "T-Shirts",
                    subtitle: "Explore every fit in the men's t-shirt lineup."
                },
                {
                    id: "oversized",
                    navLabel: "Oversized",
                    title: "Oversized T-Shirts",
                    subtitle: "Relaxed fits with a stronger visual stance.",
                    fit: "oversized"
                },
                {
                    id: "regular",
                    navLabel: "Regular",
                    title: "Regular T-Shirts",
                    subtitle: "Clean, everyday staples with structured proportions.",
                    fit: "regular"
                }
            ]
        },
        {
            id: "shirts",
            navLabel: "Shirts",
            title: "Shirts",
            subtitle: "Refined layering essentials for smart casual styling.",
            type: "shirt"
        },
        {
            id: "shorts",
            navLabel: "Shorts",
            title: "Shorts",
            subtitle: "Comfort-first silhouettes for daily movement.",
            type: "short"
        },
        {
            id: "sweatpants",
            navLabel: "Sweatpants",
            title: "Sweatpants",
            subtitle: "Relaxed jogger fits for off-duty and travel looks.",
            type: "sweatpant"
        }
    ]
})
