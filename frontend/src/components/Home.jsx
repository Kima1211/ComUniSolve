import { useAuth } from '../auth-context'
import ProblemFeed from './ProblemFeed'
import Layout from './Layout'
import Landing from './Landing'
import LoadingScreen from './LoadingScreen'

function Home() {
    const { user, loading } = useAuth()

    if (loading) return <LoadingScreen />

    if (!user) return <Layout><Landing /></Layout>

    return <Layout><ProblemFeed /></Layout>
}

export default Home
