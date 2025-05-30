import React, { FC, useEffect, useState, useCallback } from "react";
import { useLocation, useNavigate } from "react-router";
import { FaArrowRight, FaSearch } from "react-icons/fa";
import { API_ENDPOINTS } from "../lib/config";
import { useNotifications } from "../lib/notifications";
import Footer from "../components/Footer";
import { getErrorMessage } from "../lib/errors";
import debounce from 'lodash/debounce';

interface TopicSuggestion {
  name: string;
  count: number;
}

const HomeView: FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { notify } = useNotifications();
  const error = ((location.state as { error?: unknown } | undefined)?.error || "") + "";

  // Add state for the search term and suggestions
  const [searchTerm, setSearchTerm] = useState("");
  const [suggestions, setSuggestions] = useState<TopicSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);

  useEffect(() => {
    if (error)
      notify({
        message: getErrorMessage(error),
        type: "error",
      });
  }, [error, notify]);

  // Debounced function to fetch suggestions
  const fetchSuggestions = useCallback(
    debounce(async (query: string) => {
      if (!query.trim()) {
        setSuggestions([]);
        return;
      }

      setIsLoadingSuggestions(true);
      try {
        const response = await fetch(`${API_ENDPOINTS.SUGGEST_TOPICS}?query=${encodeURIComponent(query)}`);
        const data = await response.json();
        if (data.success) {
          setSuggestions(data.suggestions);
        } else {
          throw new Error(data.message || 'Failed to get suggestions');
        }
      } catch (error) {
        console.error('Error fetching suggestions:', error);
        setSuggestions([]);
      } finally {
        setIsLoadingSuggestions(false);
      }
    }, 300),
    []
  );

  // Update suggestions when search term changes
  useEffect(() => {
    fetchSuggestions(searchTerm);
  }, [searchTerm, fetchSuggestions]);

  // Function to handle search submission
  const handleSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setShowSuggestions(false);

    if (searchTerm.trim()) {
      navigate('/topics', {
        state: {
          searchTerm: searchTerm.trim(),
          userTopic: searchTerm.trim()
        }
      });
    }
  };

  // Function to handle suggestion click
  const handleSuggestionClick = (suggestion: TopicSuggestion) => {
    setSearchTerm(suggestion.name);
    setShowSuggestions(false);
    navigate('/topics', {
      state: {
        searchTerm: suggestion.name,
        userTopic: suggestion.name
      }
    });
  };

  return (
    <main className="home-view d-flex flex-column justify-content-center" style={{ padding: "0 2rem", minHeight: "100vh", paddingTop: "10vh" }}>
      <div className="title-block text-center">
        <img
          src={import.meta.env.BASE_URL + "deepgit_logo.png" || "/placeholder.svg"}
          alt="DeepGit Logo"
          className="mb-3"
          style={{ width: "150px", height: "auto" }}
        />
        <h1 className="mb-4">
          <span className="position-relative">
            DeepGit{" "}
            <small className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-warning fs-6">
              beta
            </small>
          </span>
        </h1>
        <h2 className="h5 mb-4" style={{ maxWidth: "500px", margin: "0 auto" }}>
          Discover and explore research software using large scale graphs
        </h2>

        {/* Search form with suggestions */}
        <form onSubmit={handleSearch} className="search-bar mb-4 d-flex justify-content-center position-relative">
          <div
            className="input-group align-items-center"
            style={{
              border: "1px solid #ddd",
              borderRadius: "20px",
              overflow: "hidden",
              width: "800px",
              boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
              backgroundColor: "#fff",
              position: "relative",
            }}
          >
            <span
              className="input-group-text border-0"
              style={{
                padding: "0.75rem",
                fontSize: "1rem",
                color: "#6c757d",
                backgroundColor: "transparent",
              }}
            >
              <FaSearch />
            </span>
            <input
              type="text"
              className="form-control border-0"
              placeholder="Type topic (spaces become dashes)"
              style={{
                boxShadow: "none",
                fontSize: "1rem",
                padding: "0.75rem",
                backgroundColor: "transparent",
              }}
              value={searchTerm}
              onChange={(e) => {
                const value = e.target.value.replace(/\s+/g, '-');
                setSearchTerm(value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            />
            <button
              type="submit"
              className="btn border-0"
              style={{
                padding: "0.75rem",
                fontSize: "1rem",
                color: "#6c757d",
                backgroundColor: "transparent",
                transition: "color 0.3s ease",
              }}
              disabled={!searchTerm.trim()}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#1e90ff")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#6c757d")}
            >
              <FaArrowRight />
            </button>
          </div>

          {/* Suggestions dropdown */}
          {showSuggestions && (searchTerm.trim() || isLoadingSuggestions) && (
            <div
              className="position-absolute bg-white rounded-3 shadow-lg"
              style={{
                top: "calc(100% + 8px)",
                left: "50%",
                transform: "translateX(-50%)",
                width: "700px",
                maxHeight: "300px",
                overflowY: "auto",
                zIndex: 1000,
                border: "1px solid rgba(0,0,0,0.08)",
                backdropFilter: "blur(8px)",
                backgroundColor: "rgba(255, 255, 255, 0.98)",
              }}
            >
              {isLoadingSuggestions ? (
                <div className="p-4 text-center">
                  <div className="spinner-border spinner-border-sm text-primary me-2" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                  <span className="text-muted">Finding relevant topics...</span>
                </div>
              ) : suggestions.length > 0 ? (
                <div className="list-group list-group-flush">
                  {suggestions.map((suggestion, index) => (
                    <button
                      key={suggestion.name}
                      className="list-group-item list-group-item-action d-flex justify-content-between align-items-center py-3 px-4"
                      onClick={() => handleSuggestionClick(suggestion)}
                      style={{
                        border: "none",
                        cursor: "pointer",
                        transition: "all 0.2s ease",
                        backgroundColor: "transparent",
                        borderBottom: index !== suggestions.length - 1 ? "1px solid rgba(0,0,0,0.05)" : "none",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = "rgba(13, 110, 253, 0.05)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "transparent";
                      }}
                    >
                      <div className="d-flex align-items-center">
                        <span className="me-2" style={{ fontSize: "1.1rem" }}>{suggestion.name}</span>
                        {index === 0 && suggestion.name.toLowerCase() === searchTerm.toLowerCase() && (
                          <span className="badge bg-success rounded-pill" style={{ fontSize: "0.7rem" }}>
                            Exact match
                          </span>
                        )}
                      </div>
                      <div className="d-flex align-items-center">
                        <span
                          className="badge rounded-pill px-3 py-2"
                          style={{
                            backgroundColor: "rgba(108, 117, 125, 0.1)",
                            color: "#495057",
                            fontSize: "0.9rem",
                            fontWeight: "500"
                          }}
                        >
                          {suggestion.count.toLocaleString()} repos
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="p-4 text-center">
                  <div className="text-muted mb-2">
                    <i className="fas fa-search me-2"></i>
                    No matching topics found
                  </div>
                  <small className="text-muted">Try a different search term</small>
                </div>
              )}
            </div>
          )}
        </form>

        <div className="tags d-flex flex-wrap justify-content-center mb-4" style={{ maxWidth: "600px", margin: "0 auto" }}>
          {[
            "visual-programming",
            "machine-learning",
            "logic-programming",
            "large-language-models",
          ].map((tag) => (
            <button
              key={tag}
              className="btn btn-outline-secondary m-1"
              style={{
                borderRadius: "20px",
                padding: "0.5rem 1rem",
                border: "1px solid #ddd",
                backgroundColor: "#fff",
                boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
                fontSize: "1rem",
                color: "#212529",
                transition: "background-color 0.3s ease, box-shadow 0.3s ease",
              }}
              onClick={() => {
                setSearchTerm(tag);
                navigate('/topics', {
                  state: {
                    searchTerm: tag,
                    userTopic: tag
                  }
                });
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#f8f9fa";
                e.currentTarget.style.boxShadow = "0 2px 6px rgba(0, 0, 0, 0.15)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "#fff";
                e.currentTarget.style.boxShadow = "0 1px 3px rgba(0, 0, 0, 0.1)";
              }}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>
      <div className="footer p-2">
        <Footer />
      </div>
    </main>
  );
};

export default HomeView;