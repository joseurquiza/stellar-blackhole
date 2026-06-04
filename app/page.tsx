import { Rocket } from "lucide-react"
import Link from "next/link"
import { Header } from "@/components/header"

export default function LandingPage() {
  return (
    <div className="dark min-h-screen bg-black text-white font-sans">
      <Header />
      <main className="px-4 sm:px-6 lg:px-8">
        <HeroSection />
        <VideoSection />
        <AboutSection />
      </main>
    </div>
  )
}

function HeroSection() {
  return (
    <section className="relative text-center py-12 sm:py-20 md:py-32 pb-32 sm:pb-40 md:pb-48">
      <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-extrabold max-w-4xl mx-auto leading-tight px-4">
        Empowering Positive Actions Through Blockchain Technology
      </h1>
      <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row flex-wrap justify-center items-center gap-4 px-4">
        <div className="relative group w-full sm:w-auto">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full blur-lg opacity-75 group-hover:opacity-100 transition duration-1000 group-hover:duration-200"></div>
          <Link
            href="https://app.action-tokens.com/"
            className="relative px-6 sm:px-7 py-3 sm:py-4 bg-black rounded-full flex items-center justify-center gap-2 text-base sm:text-lg font-semibold w-full sm:w-auto"
          >
            <Rocket className="w-4 sm:w-5 h-4 sm:h-5" />
            <span>Launch WebApp</span>
          </Link>
        </div>
      </div>

      <div className="absolute bottom-8 sm:bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3 z-50">
        <div className="w-7 h-11 border-2 border-white rounded-full flex justify-center pt-2 bg-black/40 backdrop-blur-sm shadow-2xl">
          <div className="w-1.5 h-3 bg-green-400 rounded-full animate-scroll shadow-[0_0_20px_rgba(74,222,128,1)]"></div>
        </div>
        <span className="text-xs text-white uppercase tracking-widest font-semibold drop-shadow-lg">Scroll</span>
      </div>
    </section>
  )
}

function VideoSection() {
  return (
    <div className="relative max-w-5xl mx-auto rounded-2xl overflow-hidden shadow-2xl shadow-green-500/10 mb-8 sm:mb-0">
      <video src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/ActionverseMap-X2vlFXGmLI0p26TiezQ7Evzk1GlmAf.webm" autoPlay loop muted playsInline className="w-full h-full object-cover" />
    </div>
  )
}

function AboutSection() {
  return (
    <section className="py-12 sm:py-20 md:py-32 max-w-6xl mx-auto">
      <div className="text-center mb-12 sm:mb-16 px-4">
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4">
          Empowering Positive Actions in the Real World
        </h2>
        <p className="text-lg sm:text-xl text-green-400 mb-6">Place Bounties, Inspire Giving, Create Real-World Impact</p>
        <p className="text-base sm:text-lg text-gray-300 max-w-4xl mx-auto leading-relaxed">
          Organizations can place digital pins, challenges, and bounties at real-world locations to inspire positive actions. Whether it's encouraging donations to charities, volunteering at community centers, or completing meaningful tasks — users explore the map, navigate to locations, take action, and prove their impact to claim rewards on the blockchain.
        </p>
        <div className="mt-8 bg-gradient-to-br from-green-900/40 to-gray-900/50 border border-green-700/50 rounded-lg p-4 sm:p-6 max-w-3xl mx-auto">
          <p className="text-sm sm:text-base text-gray-300 leading-relaxed">
            <span className="font-semibold text-green-400">Example:</span> A nonprofit places a pin at their location with a bounty requiring a $20 donation. Users visit the location, make the donation, and prove it by collecting the pin while physically there or by uploading a receipt. Once verified, they claim tokens as a reward for their positive action.
          </p>
        </div>
      </div>

      <div className="mb-16 sm:mb-20 px-4">
        <h3 className="text-xl sm:text-2xl md:text-3xl font-bold text-center mb-8 sm:mb-12">How It Works</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
          <div className="bg-gradient-to-br from-purple-900/30 to-gray-900/50 border border-purple-700/50 rounded-lg p-4 sm:p-6">
            <h4 className="text-lg sm:text-xl font-semibold mb-3 text-purple-400">For Organizations</h4>
            <p className="text-sm sm:text-base text-gray-300 mb-4">
              Sign up and start placing bounties, challenges, and scavenger hunts on the map. Drop pins at real-world locations with tasks, rewards, and time limits.
            </p>
            <ul className="text-sm text-gray-400 space-y-2">
              <li>• Create geo-fenced challenges</li>
              <li>• Set bounties for work to be done</li>
              <li>• Launch AR scavenger hunts</li>
              <li>• Reward users with tokens</li>
            </ul>
          </div>
          <div className="bg-gradient-to-br from-blue-900/30 to-gray-900/50 border border-blue-700/50 rounded-lg p-4 sm:p-6">
            <h4 className="text-lg sm:text-xl font-semibold mb-3 text-blue-400">For Users</h4>
            <p className="text-sm sm:text-base text-gray-300 mb-4">
              Explore the interactive map, find bounties near you, navigate to locations, complete challenges, and claim your rewards instantly on the blockchain.
            </p>
            <ul className="text-sm text-gray-400 space-y-2">
              <li>• Browse bounties on the map</li>
              <li>• Navigate to real-world locations</li>
              <li>• Complete tasks and challenges</li>
              <li>• Claim tokens and rewards</li>
            </ul>
          </div>
          <div className="bg-gradient-to-br from-green-900/30 to-gray-900/50 border border-green-700/50 rounded-lg p-4 sm:p-6">
            <h4 className="text-lg sm:text-xl font-semibold mb-3 text-green-400">Place Bounties</h4>
            <p className="text-sm sm:text-base text-gray-300">
              Organizations can place bounties for specific work, challenges, or tasks at physical locations. Set requirements, rewards, and deadlines — users complete them and get paid.
            </p>
          </div>
          <div className="bg-gradient-to-br from-yellow-900/30 to-gray-900/50 border border-yellow-700/50 rounded-lg p-4 sm:p-6">
            <h4 className="text-lg sm:text-xl font-semibold mb-3 text-yellow-400">Scavenger Hunts</h4>
            <p className="text-sm sm:text-base text-gray-300">
              Create multi-location scavenger hunts where users must visit specific places in order, solve puzzles, or find hidden AR objects to unlock the final reward.
            </p>
          </div>
        </div>
      </div>

      <div className="mb-16 sm:mb-20 px-4">
        <h3 className="text-xl sm:text-2xl md:text-3xl font-bold text-center mb-8 sm:mb-12">Use Cases</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          <div className="bg-gradient-to-br from-pink-900/30 to-gray-900/50 border border-pink-700/50 rounded-lg p-4 sm:p-6">
            <h4 className="text-base sm:text-lg font-semibold mb-2 text-pink-400">Charity & Philanthropy</h4>
            <p className="text-sm text-gray-300">
              Nonprofits place pins at their locations requiring donations or volunteer hours. Users prove their contribution with receipts or by checking in physically, then claim reward tokens for their positive impact.
            </p>
          </div>
          <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4 sm:p-6">
            <h4 className="text-base sm:text-lg font-semibold mb-2 text-purple-400">Marketing Campaigns</h4>
            <p className="text-sm text-gray-300">
              Place promotional bounties at store locations. Reward customers who visit, scan QR codes, or complete actions with tokens or discounts.
            </p>
          </div>
          <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4 sm:p-6">
            <h4 className="text-base sm:text-lg font-semibold mb-2 text-blue-400">Event Engagement</h4>
            <p className="text-sm text-gray-300">
              Create scavenger hunts for conferences, festivals, or trade shows. Guide attendees to booths, sessions, or hidden locations for rewards.
            </p>
          </div>
          <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4 sm:p-6">
            <h4 className="text-base sm:text-lg font-semibold mb-2 text-yellow-400">Community Building</h4>
            <p className="text-sm text-gray-300">
              DAOs and communities can place bounties for real-world tasks like cleanup events, volunteer work, or local meetups.
            </p>
          </div>
          <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4 sm:p-6">
            <h4 className="text-base sm:text-lg font-semibold mb-2 text-green-400">Freelance Work</h4>
            <p className="text-sm text-gray-300">
              Post location-based bounties for tasks like photography, deliveries, inspections, or research at specific places.
            </p>
          </div>
          <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4 sm:p-6">
            <h4 className="text-base sm:text-lg font-semibold mb-2 text-orange-400">Education & Learning</h4>
            <p className="text-sm text-gray-300">
              Create educational scavenger hunts at museums, historical sites, or campuses. Reward learners for exploring and engaging with knowledge.
            </p>
          </div>
        </div>
      </div>

      <div className="mb-16 sm:mb-20 px-4">
        <h3 className="text-xl sm:text-2xl md:text-3xl font-bold text-center mb-8 sm:mb-12">💡 Why Stellar?</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <div className="text-center p-3 sm:p-4 bg-gray-900/50 border border-gray-800 rounded-lg">
            <div className="text-xl sm:text-2xl mb-2">🌍</div>
            <p className="text-xs sm:text-sm font-semibold text-green-400">Global-ready</p>
          </div>
          <div className="text-center p-3 sm:p-4 bg-gray-900/50 border border-gray-800 rounded-lg">
            <div className="text-xl sm:text-2xl mb-2">⚡</div>
            <p className="text-xs sm:text-sm font-semibold text-green-400">Near-zero fees</p>
          </div>
          <div className="text-center p-3 sm:p-4 bg-gray-900/50 border border-gray-800 rounded-lg">
            <div className="text-xl sm:text-2xl mb-2">🔐</div>
            <p className="text-xs sm:text-sm font-semibold text-green-400">Built-in compliance</p>
          </div>
          <div className="text-center p-3 sm:p-4 bg-gray-900/50 border border-gray-800 rounded-lg">
            <div className="text-xl sm:text-2xl mb-2">📲</div>
            <p className="text-xs sm:text-sm font-semibold text-green-400">Fast onboarding</p>
          </div>
        </div>
        <p className="text-center text-sm sm:text-base text-gray-300 max-w-2xl mx-auto">
          We're building on Stellar because it's made for real adoption — not just speculation.
        </p>
      </div>

      <div className="text-center px-4">
        <h3 className="text-xl sm:text-2xl md:text-3xl font-bold mb-6 sm:mb-8">🚀 Ready to Build?</h3>
        <p className="text-base sm:text-lg text-gray-300 mb-6 sm:mb-8 max-w-2xl mx-auto">
          Whether you're just getting started or already leading a community — we'll help you launch, scale, and reward
          action.
        </p>
        <div className="flex flex-col sm:flex-row flex-wrap justify-center gap-3 sm:gap-4">
          <Link
            href="https://app.action-tokens.com/"
            className="bg-green-500 hover:bg-green-600 px-5 sm:px-6 py-2 sm:py-3 rounded-full font-semibold transition-colors text-sm sm:text-base"
          >
            👉 Get Started
          </Link>
          <Link
            href="https://app.action-tokens.com/"
            className="bg-purple-600 hover:bg-purple-700 px-5 sm:px-6 py-2 sm:py-3 rounded-full font-semibold transition-colors text-sm sm:text-base"
          >
            👉 Create Your Token
          </Link>
          <Link
            href="https://map.action-tokens.com"
            className="bg-blue-600 hover:bg-blue-700 px-5 sm:px-6 py-2 sm:py-3 rounded-full font-semibold transition-colors text-sm sm:text-base"
          >
            👉 Explore the Map
          </Link>
        </div>
      </div>
    </section>
  )
}
