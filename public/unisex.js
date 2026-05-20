initCollectionPage({
    key: "unisex",
    gender: "unisex",
    pageTitle: "Unisex Collection",
    heroEyebrow: "UNISEX EDIT",
    heroTitle: "UNISEX COLLECTION",
    heroSubtitle: "Style beyond labels with universal fits and clean, bold silhouettes.",
    heroFallbackImage: "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&w=1800&q=80",
    bannerType: "unisexHero",
    bannerTypes: ["unisexHero", "unisexHero2", "unisexHero3"],
    quickTypes: [
        { value: "all", label: "All" },
        { value: "tshirt", label: "T-Shirts" }
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
            subtitle: "Universal silhouettes with expressive and everyday fits.",
            type: "tshirt",
            cardAliases: ["oversized", "regular"],
            subcategories: [
                {
                    id: "all",
                    navLabel: "All Fits",
                    title: "T-Shirts",
                    subtitle: "Explore every fit in the unisex t-shirt lineup."
                },
                {
                    id: "oversized",
                    navLabel: "Oversized",
                    title: "Oversized T-Shirts",
                    subtitle: "Relaxed silhouettes with universal appeal.",
                    fit: "oversized"
                },
                {
                    id: "regular",
                    navLabel: "Regular",
                    title: "Regular T-Shirts",
                    subtitle: "Balanced fits for everyday versatility.",
                    fit: "regular"
                }
            ]
        }
    ]
})
